import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, orderItems, Order, OrderItem } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET /api/orders — list with items
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });

  const allOrders: Order[] = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const allItems: OrderItem[] = await db.select().from(orderItems);

  const result = allOrders.map((o: Order) => ({
    ...o,
    items: allItems
      .filter((i: OrderItem) => i.orderId === o.id)
      .sort((a: OrderItem, b: OrderItem) => a.sortOrder - b.sortOrder),
  }));

  return NextResponse.json(result);
}

// POST /api/orders — create order with items
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id ?? "";

  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const body = await req.json();
  const { clientId, clientName, note, totalPrice, supplierTotal, clientPaid, wePaid, deliveryType, estimatedShipDate, items } = body;

  const orderId = randomUUID();
  const now = new Date().toISOString();

  await db.insert(orders).values({
    id: orderId,
    clientId: clientId || null,
    clientName: clientName?.trim() || null,
    note: note?.trim() || null,
    totalPrice: totalPrice?.trim() || null,
    supplierTotal: supplierTotal?.trim() || null,
    clientPaid: clientPaid?.trim() || null,
    wePaid: wePaid?.trim() || null,
    deliveryType: deliveryType || null,
    estimatedShipDate: estimatedShipDate || null,
    status: "WAITING_PAYMENT",
    createdAt: now,
    createdBy: userId,
  });

  if (Array.isArray(items) && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // colors може бути JSON масив або string
      const colorsValue = typeof item.colors === "object" 
        ? JSON.stringify(item.colors) 
        : (item.colors?.trim?.() || null);
      
      await db.insert(orderItems).values({
        id: randomUUID(),
        orderId,
        photoPath: item.photoPath || null,
        supplier: item.supplier?.trim() || null,
        modelNumber: item.modelNumber?.trim() || null,
        price: item.price?.trim() || null,
        colors: colorsValue,
        sortOrder: i,
      });
    }
  }

  return NextResponse.json({ id: orderId }, { status: 201 });
}
