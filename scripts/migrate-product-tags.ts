// Скрипт для додавання колонки tags у таблицю products (Turso / SQLite)
// Запуск: npx dotenv -e .env -- npx tsx scripts/migrate-product-tags.ts
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log("Перевірка колонки tags у products...");

  const res = await client.execute("SELECT name FROM pragma_table_info('products')");
  const cols = res.rows.map((r) => String((r as unknown as Record<string, unknown>).name ?? ""));

  if (cols.includes("tags")) {
    console.log("✅ tags вже існує — пропускаємо.");
    return;
  }

  await client.execute("ALTER TABLE products ADD COLUMN tags TEXT");
  console.log("✅ Колонку tags додано!");
}

migrate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Помилка:", e);
    process.exit(1);
  });
