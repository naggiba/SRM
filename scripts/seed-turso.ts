// Скрипт для створення адміна в Turso базі
import { createClient } from "@libsql/client";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function seed() {
  console.log("Підключення до Turso...");
  
  // Створюємо таблиці
  console.log("Створення таблиць...");
  
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

  console.log("Таблиці створено!");

  // Перевіряємо чи є адмін
  const existing = await client.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: ["admin@crm.com"],
  });

  if (existing.rows.length > 0) {
    console.log("Адмін вже існує!");
    return;
  }

  // Створюємо адміна
  const hashedPassword = await bcrypt.hash("admin123", 10);
  
  await client.execute({
    sql: `INSERT INTO users (id, name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      randomUUID(),
      "Адміністратор",
      "admin@crm.com",
      hashedPassword,
      "ADMIN",
      new Date().toISOString(),
    ],
  });

  console.log("✅ Адмін створений!");
  console.log("   Email: admin@crm.com");
  console.log("   Пароль: admin123");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Помилка:", e);
    process.exit(1);
  });
