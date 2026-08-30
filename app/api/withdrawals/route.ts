import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { withdrawals, withdrawalCategories } from "@/lib/schema";
import { desc, eq, gte } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET /api/withdrawals — список виплат (опційно за період)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });

  const period = req.nextUrl.searchParams.get("period") ?? "all";

  let since: string | null = null;
  const now = new Date();
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    since = d.toISOString();
  } else if (period === "month") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    since = d.toISOString();
  }

  const list = since
    ? await db.select().from(withdrawals).where(gte(withdrawals.createdAt, since)).orderBy(desc(withdrawals.createdAt))
    : await db.select().from(withdrawals).orderBy(desc(withdrawals.createdAt));

  return NextResponse.json(list);
}

// POST /api/withdrawals — додати виплату (вивід зароблених коштів)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || role === "VIEWER" || !userId) {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const body = await req.json();
  const { categoryId, categoryName, amount, note } = body;

  const amt = parseFloat(amount);
  if (!amt || amt <= 0) {
    return NextResponse.json({ error: "Вкажіть коректну суму" }, { status: 400 });
  }
  if (!categoryName?.trim()) {
    return NextResponse.json({ error: "Оберіть категорію" }, { status: 400 });
  }

  let finalCategoryId = categoryId || null;

  // Якщо категорію передали як нову назву — створюємо або знаходимо
  if (!finalCategoryId) {
    const name = categoryName.trim();
    const [existing] = await db.select().from(withdrawalCategories).where(eq(withdrawalCategories.name, name)).limit(1);
    if (existing) {
      finalCategoryId = existing.id;
    } else {
      finalCategoryId = randomUUID();
      await db.insert(withdrawalCategories).values({
        id: finalCategoryId,
        name,
        createdAt: new Date().toISOString(),
      });
    }
  }

  const id = randomUUID();
  await db.insert(withdrawals).values({
    id,
    categoryId: finalCategoryId,
    categoryName: categoryName.trim(),
    amount: String(amt),
    note: note?.trim() || null,
    createdAt: new Date().toISOString(),
    createdBy: userId,
  });

  const [created] = await db.select().from(withdrawals).where(eq(withdrawals.id, id));
  return NextResponse.json(created, { status: 201 });
}
