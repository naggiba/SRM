import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems, payments } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET /api/orders/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });

  const { id } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return NextResponse.json({ error: "Не знайдено" }, { status: 404 });

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(orderItems.sortOrder);

  const orderPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, id))
    .orderBy(payments.createdAt);

  return NextResponse.json({ ...order, items, payments: orderPayments });
}

// PATCH /api/orders/[id] — update status/note/items/payments
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, string | null> = {};

  if (body.status !== undefined) updates.status = body.status;
  if (body.note !== undefined) updates.note = body.note?.trim() || null;
  if (body.clientName !== undefined) updates.clientName = body.clientName?.trim() || null;
  if (body.totalPrice !== undefined) updates.totalPrice = body.totalPrice?.trim() || null;
  if (body.deliveryType !== undefined) updates.deliveryType = body.deliveryType || null;
  if (body.estimatedShipDate !== undefined) updates.estimatedShipDate = body.estimatedShipDate || null;
  if (body.orderDate !== undefined) updates.orderDate = body.orderDate || null;
  if (body.cargoPhotoPath !== undefined) updates.cargoPhotoPath = body.cargoPhotoPath || null;

  if (Object.keys(updates).length > 0) {
    await db.update(orders).set(updates).where(eq(orders.id, id));
  }

  // replace items if provided
  if (Array.isArray(body.items)) {
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      // colors може бути JSON масив або string
      const colorsValue = typeof item.colors === "object" 
        ? JSON.stringify(item.colors) 
        : (item.colors?.trim() || null);
      
      await db.insert(orderItems).values({
        id: item.id || randomUUID(),
        orderId: id,
        photoPath: item.photoPath || null,
        supplier: item.supplier?.trim() || null,
        modelNumber: item.modelNumber?.trim() || null,
        price: item.price?.trim() || null,
        colors: colorsValue,
        sortOrder: i,
      });
    }
  }

  // replace payments if provided
  if (Array.isArray(body.payments)) {
    await db.delete(payments).where(eq(payments.orderId, id));
    for (const p of body.payments) {
      await db.insert(payments).values({
        id: p.id || randomUUID(),
        orderId: id,
        type: p.type,
        amount: p.amount?.trim() || "0",
        photoPath: p.photoPath || null,
        note: p.note?.trim() || null,
        createdAt: p.createdAt || new Date().toISOString(),
      });
    }
    
    // Recalculate totals
    const allPayments = await db.select().from(payments).where(eq(payments.orderId, id));
    const clientPaid = allPayments
      .filter((p: { type: string }) => p.type === "CLIENT")
      .reduce((sum: number, p: { amount: string }) => sum + (parseFloat(p.amount) || 0), 0);
    const wePaid = allPayments
      .filter((p: { type: string }) => p.type === "SUPPLIER")
      .reduce((sum: number, p: { amount: string }) => sum + (parseFloat(p.amount) || 0), 0);
    
    await db.update(orders).set({
      clientPaid: clientPaid.toString(),
      wePaid: wePaid.toString(),
    }).where(eq(orders.id, id));
  }

  const [updated] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(orderItems.sortOrder);
  const orderPayments = await db.select().from(payments).where(eq(payments.orderId, id)).orderBy(payments.createdAt);

  return NextResponse.json({ ...updated, items, payments: orderPayments });
}

// DELETE /api/orders/[id] (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { id } = await params;
  await db.delete(payments).where(eq(payments.orderId, id));
  await db.delete(orderItems).where(eq(orderItems.orderId, id));
  await db.delete(orders).where(eq(orders.id, id));
  return NextResponse.json({ ok: true });
}
