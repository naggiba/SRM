import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { extraExpenses } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET /api/orders/[id]/expenses
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });

  const { id } = await params;
  const list = await db.select().from(extraExpenses).where(eq(extraExpenses.orderId, id));
  return NextResponse.json(list);
}

// POST /api/orders/[id]/expenses — додати витрату
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { description, amount } = body;

  if (!description?.trim() || !amount?.trim()) {
    return NextResponse.json({ error: "Назва та сума обов'язкові" }, { status: 400 });
  }

  const expenseId = randomUUID();
  await db.insert(extraExpenses).values({
    id: expenseId,
    orderId: id,
    description: description.trim(),
    amount: amount.trim(),
    createdAt: new Date().toISOString(),
  });

  const [created] = await db.select().from(extraExpenses).where(eq(extraExpenses.id, expenseId));
  return NextResponse.json(created, { status: 201 });
}

// DELETE /api/orders/[id]/expenses — видалити витрату (передається expenseId в body)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { id: orderId } = await params;
  const body = await req.json();
  const { expenseId } = body;

  await db.delete(extraExpenses).where(eq(extraExpenses.id, expenseId));
  return NextResponse.json({ ok: true, orderId });
}
