import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderItems } from "@/lib/schema";
import { and, eq, inArray } from "drizzle-orm";

// PATCH /api/orders/[id]/items — оновити статус частини замовлення (постачальника)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { itemIds, status } = body;

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return NextResponse.json({ error: "Не вказано товари" }, { status: 400 });
  }
  if (!status) {
    return NextResponse.json({ error: "Не вказано статус" }, { status: 400 });
  }

  // Оновлюємо лише товари, що належать цьому замовленню
  await db
    .update(orderItems)
    .set({ status })
    .where(and(eq(orderItems.orderId, id), inArray(orderItems.id, itemIds)));

  return NextResponse.json({ success: true });
}
