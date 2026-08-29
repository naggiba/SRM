import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, payments, extraExpenses } from "@/lib/schema";
import { gte } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });

  const period = req.nextUrl.searchParams.get("period") ?? "all";

  // Визначаємо дату початку
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

  // Отримуємо замовлення за період
  const allOrders = since
    ? await db.select().from(orders).where(gte(orders.createdAt, since))
    : await db.select().from(orders);

  const orderIds = allOrders.map((o) => o.id);

  if (orderIds.length === 0) {
    return NextResponse.json({
      period,
      orderCount: 0,
      totalCNY: 0,
      clientPaidCNY: 0,
      clientPaidUAH: 0,
      wePaidCNY: 0,
      expensesCNY: 0,
      profit: 0,
      byOrder: [],
    });
  }

  // Отримуємо всі payments та expenses
  const allPayments = since
    ? await db.select().from(payments).where(gte(payments.createdAt, since))
    : await db.select().from(payments);

  const allExpenses = since
    ? await db.select().from(extraExpenses).where(gte(extraExpenses.createdAt, since))
    : await db.select().from(extraExpenses);

  // Фільтруємо тільки для наших замовлень
  const orderIdSet = new Set(orderIds);
  const filteredPayments = allPayments.filter((p) => orderIdSet.has(p.orderId));
  const filteredExpenses = allExpenses.filter((e) => orderIdSet.has(e.orderId));

  // Підсумки
  const totalCNY = allOrders.reduce((s, o) => s + (parseFloat(o.totalPrice ?? "0") || 0), 0);

  const clientPaidCNY = filteredPayments
    .filter((p) => p.type === "CLIENT")
    .reduce((s, p) => {
      const amt = parseFloat(p.amount) || 0;
      if (p.currency === "UAH") {
        const rate = parseFloat(p.exchangeRate ?? "0") || 0;
        return s + (rate > 0 ? amt / rate : 0);
      }
      return s + amt;
    }, 0);

  const clientPaidUAH = filteredPayments
    .filter((p) => p.type === "CLIENT" && p.currency === "UAH")
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const wePaidCNY = filteredPayments
    .filter((p) => p.type === "SUPPLIER")
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const expensesCNY = filteredExpenses
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const profit = clientPaidCNY - wePaidCNY - expensesCNY;

  // По кожному замовленню
  const byOrder = allOrders.map((o) => {
    const oPayments = filteredPayments.filter((p) => p.orderId === o.id);
    const oExpenses = filteredExpenses.filter((e) => e.orderId === o.id);

    const oCNY = oPayments
      .filter((p) => p.type === "CLIENT")
      .reduce((s, p) => {
        const amt = parseFloat(p.amount) || 0;
        if (p.currency === "UAH") {
          const rate = parseFloat(p.exchangeRate ?? "0") || 0;
          return s + (rate > 0 ? amt / rate : 0);
        }
        return s + amt;
      }, 0);

    const oWe = oPayments
      .filter((p) => p.type === "SUPPLIER")
      .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

    const oExp = oExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

    return {
      id: o.id,
      clientName: o.clientName,
      orderDate: o.orderDate,
      createdAt: o.createdAt,
      status: o.status,
      totalCNY: parseFloat(o.totalPrice ?? "0") || 0,
      clientPaidCNY: oCNY,
      wePaidCNY: oWe,
      expensesCNY: oExp,
      profit: oCNY - oWe - oExp,
    };
  });

  return NextResponse.json({
    period,
    orderCount: allOrders.length,
    totalCNY,
    clientPaidCNY,
    clientPaidUAH,
    wePaidCNY,
    expensesCNY,
    profit,
    byOrder,
  });
}
