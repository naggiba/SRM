import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// POST /api/users — create user (admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { name, email, password, role } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Усі поля обов'язкові" }, { status: 400 });
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "Email вже використовується" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.insert(users).values({ id, name, email, password: hashed, role: role ?? "VIEWER", createdAt: now });

  const [created] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const { password: _, ...safe } = created;
  return NextResponse.json(safe, { status: 201 });
}
