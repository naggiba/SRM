import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const useTurso = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

let db: ReturnType<typeof drizzle>;

if (useTurso) {
  // Turso (Vercel / продакшен)
  // Таблиці вже створені через seed-turso.ts — initDb не потрібен
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  db = drizzle(client, { schema });
} else {
  // Локальна SQLite (розробка)
  /* eslint-disable @typescript-eslint/no-require-imports */
  const Database = require("better-sqlite3");
  const { drizzle: drizzleSqlite } = require("drizzle-orm/better-sqlite3");
  const path = require("path");
  /* eslint-enable @typescript-eslint/no-require-imports */

  const dbPath = path.join(process.cwd(), "crm.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  db = drizzleSqlite(sqlite, { schema });

  sqlite.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'VIEWER', created_at TEXT NOT NULL)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, telegram TEXT, cargo_code TEXT, created_at TEXT NOT NULL)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, client_id TEXT, client_name TEXT, note TEXT, total_price TEXT, supplier_total TEXT, client_paid TEXT, we_paid TEXT, delivery_type TEXT, estimated_ship_date TEXT, order_date TEXT, cargo_photo_path TEXT, status TEXT NOT NULL DEFAULT 'NEW', created_at TEXT NOT NULL, created_by TEXT NOT NULL)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, photo_path TEXT, supplier TEXT, model_number TEXT, price TEXT, colors TEXT, sort_order INTEGER NOT NULL DEFAULT 0)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, type TEXT NOT NULL, amount TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'CNY', exchange_rate TEXT, photo_path TEXT, note TEXT, created_at TEXT NOT NULL)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS extra_expenses (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, description TEXT NOT NULL, amount TEXT NOT NULL, created_at TEXT NOT NULL)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, model_number TEXT NOT NULL UNIQUE, photo_path TEXT, supplier TEXT, price TEXT, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS withdrawal_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS withdrawals (id TEXT PRIMARY KEY, category_id TEXT, category_name TEXT NOT NULL, amount TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL, created_by TEXT NOT NULL)`);

  // Migrations
  const paymentCols = sqlite.prepare("PRAGMA table_info(payments)").all() as { name: string }[];
  const paymentColNames = paymentCols.map((c: { name: string }) => c.name);
  if (!paymentColNames.includes("currency")) sqlite.exec("ALTER TABLE payments ADD COLUMN currency TEXT NOT NULL DEFAULT 'CNY'");
  if (!paymentColNames.includes("exchange_rate")) sqlite.exec("ALTER TABLE payments ADD COLUMN exchange_rate TEXT");

  const orderCols = sqlite.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  const orderColNames = orderCols.map((c: { name: string }) => c.name);
  if (!orderColNames.includes("supplier_total")) sqlite.exec("ALTER TABLE orders ADD COLUMN supplier_total TEXT");
}

export { db };
