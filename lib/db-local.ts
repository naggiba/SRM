import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import * as schema from "./schema";

const dbPath = path.join(process.cwd(), "crm.db");
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrency
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

// Create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'VIEWER',
    created_at TEXT NOT NULL
  )
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    telegram TEXT,
    cargo_code TEXT,
    created_at TEXT NOT NULL
  )
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    client_name TEXT,
    note TEXT,
    total_price TEXT,
    client_paid TEXT,
    we_paid TEXT,
    delivery_type TEXT,
    estimated_ship_date TEXT,
    order_date TEXT,
    cargo_photo_path TEXT,
    status TEXT NOT NULL DEFAULT 'NEW',
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL
  )
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    photo_path TEXT,
    supplier TEXT,
    model_number TEXT,
    price TEXT,
    colors TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  )
`);

// Migration: add columns to orders if missing
const orderCols = sqlite.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
const orderColNames = orderCols.map((c: { name: string }) => c.name);
if (!orderColNames.includes("total_price")) {
  sqlite.exec("ALTER TABLE orders ADD COLUMN total_price TEXT");
}
if (!orderColNames.includes("client_paid")) {
  sqlite.exec("ALTER TABLE orders ADD COLUMN client_paid TEXT");
}
if (!orderColNames.includes("we_paid")) {
  sqlite.exec("ALTER TABLE orders ADD COLUMN we_paid TEXT");
}
if (!orderColNames.includes("delivery_type")) {
  sqlite.exec("ALTER TABLE orders ADD COLUMN delivery_type TEXT");
}
if (!orderColNames.includes("estimated_ship_date")) {
  sqlite.exec("ALTER TABLE orders ADD COLUMN estimated_ship_date TEXT");
}
if (!orderColNames.includes("cargo_photo_path")) {
  sqlite.exec("ALTER TABLE orders ADD COLUMN cargo_photo_path TEXT");
}
if (!orderColNames.includes("order_date")) {
  sqlite.exec("ALTER TABLE orders ADD COLUMN order_date TEXT");
}

// Payments table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount TEXT NOT NULL,
    photo_path TEXT,
    note TEXT,
    created_at TEXT NOT NULL
  )
`);
