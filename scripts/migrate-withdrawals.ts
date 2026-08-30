// Скрипт для створення таблиць withdrawals / withdrawal_categories в Turso
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log("Створення таблиць withdrawal_categories та withdrawals...");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS withdrawal_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      category_id TEXT,
      category_name TEXT NOT NULL,
      amount TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL
    )
  `);

  console.log("✅ Готово!");
}

migrate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Помилка:", e);
    process.exit(1);
  });
