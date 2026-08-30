import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { orders, payments, extraExpenses, withdrawals } from "@/lib/schema";
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

  // Виплати (виводи зароблених коштів) за період
  const allWithdrawals = since
    ? await db.select().from(withdrawals).where(gte(withdrawals.createdAt, since))
    : await db.select().from(withdrawals);
  const withdrawalsCNY = allWithdrawals.reduce((s, w) => s + (parseFloat(w.amount) || 0), 0);

  const byCategory: Record<string, number> = {};
  for (const w of allWithdrawals) {
    byCategory[w.categoryName] = (byCategory[w.categoryName] ?? 0) + (parseFloat(w.amount) || 0);
  }

  if (orderIds.length === 0) {
    return NextResponse.json({
      period,
      orderCount: 0,
      income: 0,
      incomeUAH: 0,
      expenses: 0,
      profitSentOnly: 0,
      treasury: 0,
      withdrawalsCNY,
      withdrawalsByCategory: byCategory,
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

  // --- Надходження: всі оплати від клієнтів (конвертовано в CNY) ---
  const income = filteredPayments
    .filter((p) => p.type === "CLIENT")
    .reduce((s, p) => {
      const amt = parseFloat(p.amount) || 0;
      if (p.currency === "UAH") {
        const rate = parseFloat(p.exchangeRate ?? "0") || 0;
        return s + (rate > 0 ? amt / rate : 0);
      }
      return s + amt;
    }, 0);

  const incomeUAH = filteredPayments
    .filter((p) => p.type === "CLIENT" && p.currency === "UAH")
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  // --- Витрати: постачальники + додаткові витрати ---
  const supplierPaid = filteredPayments
    .filter((p) => p.type === "SUPPLIER")
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const extraExp = filteredExpenses
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const expenses = supplierPaid + extraExp;

  // --- Казна: надходження мінус витрати постачальникам (вільні кошти на руках) ---
  const treasury = income - expenses;

  // --- Заробіток: тільки по замовленнях зі статусом SENT_TO_CARGO ---
  const sentOrders = allOrders.filter((o) => o.status === "SENT_TO_CARGO");
  const sentOrderIds = new Set(sentOrders.map((o) => o.id));

  const sentIncome = filteredPayments
    .filter((p) => p.type === "CLIENT" && sentOrderIds.has(p.orderId))
    .reduce((s, p) => {
      const amt = parseFloat(p.amount) || 0;
      if (p.currency === "UAH") {
        const rate = parseFloat(p.exchangeRate ?? "0") || 0;
        return s + (rate > 0 ? amt / rate : 0);
      }
      return s + amt;
    }, 0);

  const sentSupplier = filteredPayments
    .filter((p) => p.type === "SUPPLIER" && sentOrderIds.has(p.orderId))
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const sentExtra = filteredExpenses
    .filter((e) => sentOrderIds.has(e.orderId))
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const profitSentOnly = sentIncome - sentSupplier - sentExtra;

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
    income,
    incomeUAH,
    expenses,
    profitSentOnly,
    treasury,
    withdrawalsCNY,
    withdrawalsByCategory: byCategory,
    byOrder,
  });
}
