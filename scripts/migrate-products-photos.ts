// Скрипт для додавання колонки photo_paths у таблицю products (Turso / SQLite)
// Запуск: npx dotenv -e .env -- npx tsx scripts/migrate-products-photos.ts
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  console.log("Перевірка колонки photo_paths у products...");

  const res = await client.execute("SELECT name FROM pragma_table_info('products')");
  const cols = res.rows.map((r) => String((r as unknown as Record<string, unknown>).name ?? ""));

  if (cols.includes("photo_paths")) {
    console.log("✅ photo_paths вже існує — пропускаємо.");
    return;
  }

  await client.execute("ALTER TABLE products ADD COLUMN photo_paths TEXT");
  console.log("✅ Колонку photo_paths додано!");
}

migrate()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Помилка:", e);
    process.exit(1);
  });
