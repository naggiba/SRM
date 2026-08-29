import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems, payments, extraExpenses } from "@/lib/schema";
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

  // Паралельні запити
  const [orderResult, items, orderPayments, expenses] = await Promise.all([
    db.select().from(orders).where(eq(orders.id, id)).limit(1),
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(orderItems.sortOrder),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(payments.createdAt),
    db.select().from(extraExpenses).where(eq(extraExpenses.orderId, id)).orderBy(extraExpenses.createdAt),
  ]);

  const order = orderResult[0];
  if (!order) return NextResponse.json({ error: "Не знайдено" }, { status: 404 });

  return NextResponse.json({ ...order, items, payments: orderPayments, expenses });
}

// PATCH /api/orders/[id]
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

  // replace payments if provided (з підтримкою currency/exchangeRate)
  if (Array.isArray(body.payments)) {
    await db.delete(payments).where(eq(payments.orderId, id));
    for (const p of body.payments) {
      await db.insert(payments).values({
        id: p.id || randomUUID(),
        orderId: id,
        type: p.type,
        amount: p.amount?.trim() || "0",
        currency: p.currency || "CNY",
        exchangeRate: p.exchangeRate?.trim() || null,
        photoPath: p.photoPath || null,
        note: p.note?.trim() || null,
        createdAt: p.createdAt || new Date().toISOString(),
      });
    }

    // Перераховуємо суми — конвертуємо UAH в CNY за курсом якщо є
    const allPayments = await db.select().from(payments).where(eq(payments.orderId, id));
    const clientPaid = allPayments
      .filter((p: { type: string }) => p.type === "CLIENT")
      .reduce((sum: number, p: { amount: string; currency: string; exchangeRate: string | null }) => {
        const amt = parseFloat(p.amount) || 0;
        // Зберігаємо суму як є (в тій валюті яку ввели)
        return sum + amt;
      }, 0);
    const wePaid = allPayments
      .filter((p: { type: string }) => p.type === "SUPPLIER")
      .reduce((sum: number, p: { amount: string }) => sum + (parseFloat(p.amount) || 0), 0);

    await db.update(orders).set({
      clientPaid: clientPaid.toString(),
      wePaid: wePaid.toString(),
    }).where(eq(orders.id, id));
  }

  const [updatedResult, updatedItems, updatedPayments, updatedExpenses] = await Promise.all([
    db.select().from(orders).where(eq(orders.id, id)).limit(1),
    db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(orderItems.sortOrder),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(payments.createdAt),
    db.select().from(extraExpenses).where(eq(extraExpenses.orderId, id)).orderBy(extraExpenses.createdAt),
  ]);

  return NextResponse.json({ ...updatedResult[0], items: updatedItems, payments: updatedPayments, expenses: updatedExpenses });
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
  await db.delete(extraExpenses).where(eq(extraExpenses.orderId, id));
  await db.delete(payments).where(eq(payments.orderId, id));
  await db.delete(orderItems).where(eq(orderItems.orderId, id));
  await db.delete(orders).where(eq(orders.id, id));
  return NextResponse.json({ ok: true });
}
