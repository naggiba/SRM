import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const useTurso = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

let db: ReturnType<typeof drizzle>;

if (useTurso) {
  // Turso (Vercel / продакшен)
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  
  db = drizzle(client, { schema });

  // Ініціалізація таблиць
  (async () => {
    try {
      await client.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'VIEWER',
          created_at TEXT NOT NULL
        )
      `);

      await client.execute(`
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          telegram TEXT,
          cargo_code TEXT,
          created_at TEXT NOT NULL
        )
      `);

      await client.execute(`
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

      await client.execute(`
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

      await client.execute(`
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
    } catch (e) {
      console.error("DB init error:", e);
    }
  })();
} else {
  // Локальна SQLite (розробка)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle: drizzleSqlite } = require("drizzle-orm/better-sqlite3");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path");

  const dbPath = path.join(process.cwd(), "crm.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");

  db = drizzleSqlite(sqlite, { schema });

  // Створення таблиць локально
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
}

export { db };
