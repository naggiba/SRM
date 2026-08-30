import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { withdrawalCategories } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET /api/withdrawal-categories — список категорій
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });

  const list = await db.select().from(withdrawalCategories).orderBy(withdrawalCategories.name);
  return NextResponse.json(list);
}

// POST /api/withdrawal-categories — створити нову категорію
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Назва категорії обов'язкова" }, { status: 400 });
  }

  const [existing] = await db.select().from(withdrawalCategories).where(eq(withdrawalCategories.name, name)).limit(1);
  if (existing) {
    return NextResponse.json(existing, { status: 200 });
  }

  const id = randomUUID();
  await db.insert(withdrawalCategories).values({
    id,
    name,
    createdAt: new Date().toISOString(),
  });

  const [created] = await db.select().from(withdrawalCategories).where(eq(withdrawalCategories.id, id));
  return NextResponse.json(created, { status: 201 });
}
