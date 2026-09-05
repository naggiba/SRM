// Скрипт для додавання колонки status у таблицю order_items (Turso / SQLite)
// Запуск: npx dotenv -e .env -- npx tsx scripts/migrate-order-item-status.ts
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log("Перевірка колонки status у order_items...");

  const res = await client.execute("SELECT name FROM pragma_table_info('order_items')");
  const cols = res.rows.map((r) => String((r as unknown as Record<string, unknown>).name ?? ""));

  if (cols.includes("status")) {
    console.log("✅ status вже існує — пропускаємо.");
    return;
  }

  await client.execute("ALTER TABLE order_items ADD COLUMN status TEXT");
  console.log("✅ Колонку status додано!");
}

migrate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Помилка:", e);
    process.exit(1);
  });
