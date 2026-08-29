import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq, like, or } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET /api/clients — list (all roles)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });

  const search = req.nextUrl.searchParams.get("q");

  const rows = search
    ? await db
        .select()
        .from(clients)
        .where(
          or(
            like(clients.name, `%${search}%`),
            like(clients.telegram, `%${search}%`),
            like(clients.cargoCode, `%${search}%`)
          )
        )
        .orderBy(clients.createdAt)
    : await db.select().from(clients).orderBy(clients.createdAt);

  return NextResponse.json(rows);
}

// POST /api/clients — create (admin + manager)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { name, telegram, cargoCode } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Ім'я обов'язкове" }, { status: 400 });
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(clients).values({
    id,
    name: name.trim(),
    telegram: telegram?.trim() || null,
    cargoCode: cargoCode?.trim() || null,
    createdAt: now,
  });

  const [created] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return NextResponse.json(created, { status: 201 });
}
