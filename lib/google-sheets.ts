import { google } from "googleapis";
import { db } from "./db";
import { orders, payments, extraExpenses, withdrawals } from "./schema";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

// ── Лист "Замовлення" ────────────────────────────────────────────────────────

export async function syncOrders() {
  const sheets = getSheets();
  const allOrders = await db.select().from(orders);

  const STATUS_UA: Record<string, string> = {
    WAITING_PAYMENT: "Очікуємо оплату",
    CLIENT_PAID: "Клієнт оплатив",
    ORDERED: "Замовлено",
    SENT_TO_CARGO: "На карго",
  };

  const header = ["Клієнт", "Сума (¥)", "Дата замовлення", "Статус", "Створено"];

  const rows = allOrders.map((o) => [
    o.clientName ?? "—",
    o.totalPrice ?? "0",
    o.orderDate ?? "—",
    STATUS_UA[o.status] ?? o.status,
    o.createdAt ? new Date(o.createdAt).toLocaleDateString("uk-UA") : "—",
  ]);

  // Очищаємо лист і записуємо нові дані
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: "Замовлення!A:Z",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Замовлення!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [header, ...rows],
    },
  });

  return { orders: rows.length };
}

// ── Лист "Фінанси" ──────────────────────────────────────────────────────────

export async function syncFinance() {
  const sheets = getSheets();

  const allOrders = await db.select().from(orders);
  const allPayments = await db.select().from(payments);
  const allExpenses = await db.select().from(extraExpenses);
  const allWithdrawals = await db.select().from(withdrawals);

  const orderIdSet = new Set(allOrders.map((o) => o.id));
  const filteredPayments = allPayments.filter((p) => orderIdSet.has(p.orderId));
  const filteredExpenses = allExpenses.filter((e) => orderIdSet.has(e.orderId));

  // --- Загальні підсумки ---
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

  const supplierPaid = filteredPayments
    .filter((p) => p.type === "SUPPLIER")
    .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const extraExp = filteredExpenses
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  const expenses = supplierPaid + extraExp;

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

  const withdrawalsCNY = allWithdrawals.reduce((s, w) => s + (parseFloat(w.amount) || 0), 0);
  const treasury = income - expenses - withdrawalsCNY;

  const STATUS_UA: Record<string, string> = {
    WAITING_PAYMENT: "Очікуємо оплату",
    CLIENT_PAID: "Клієнт оплатив",
    ORDERED: "Замовлено",
    SENT_TO_CARGO: "На карго",
  };

  // --- Збираємо рядки ---
  const rows: string[][] = [];

  // Підсумки зверху
  rows.push(["ПІДСУМКИ"]);
  rows.push(["Надходження", `${income.toFixed(2)} ¥`]);
  rows.push(["Витрати", `${expenses.toFixed(2)} ¥`]);
  rows.push(["Заробіток (відправлені)", `${profitSentOnly.toFixed(2)} ¥`]);
  rows.push(["Виплати", `${withdrawalsCNY.toFixed(2)} ¥`]);
  rows.push(["Казна", `${treasury.toFixed(2)} ¥`]);
  rows.push([]);

  // По замовленнях
  rows.push(["ПО ЗАМОВЛЕННЯХ"]);
  rows.push(["Клієнт", "Дата", "Статус", "Надійшло (¥)", "Витрачено (¥)", "Прибуток (¥)"]);

  for (const o of allOrders) {
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

    rows.push([
      o.clientName ?? "—",
      o.orderDate ?? new Date(o.createdAt).toLocaleDateString("uk-UA"),
      STATUS_UA[o.status] ?? o.status,
      oCNY.toFixed(2),
      (oWe + oExp).toFixed(2),
      (oCNY - oWe - oExp).toFixed(2),
    ]);
  }

  rows.push([]);

  // Виплати
  rows.push(["ВИПЛАТИ"]);
  rows.push(["Категорія", "Сума (¥)", "Дата", "Примітка"]);

  for (const w of allWithdrawals) {
    rows.push([
      w.categoryName,
      parseFloat(w.amount).toFixed(2),
      new Date(w.createdAt).toLocaleDateString("uk-UA"),
      w.note ?? "",
    ]);
  }

  // Очищаємо лист і записуємо
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: "Фінанси!A:Z",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "Фінанси!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: rows,
    },
  });

  return {
    orders: allOrders.length,
    payments: filteredPayments.length,
    withdrawals: allWithdrawals.length,
  };
}

// ── Повний бекап ─────────────────────────────────────────────────────────────

export async function runFullBackup() {
  const ordersResult = await syncOrders();
  const financeResult = await syncFinance();
  return {
    timestamp: new Date().toISOString(),
    orders: ordersResult,
    finance: financeResult,
  };
}
