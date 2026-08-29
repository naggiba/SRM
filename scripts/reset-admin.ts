import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function resetAdmin() {
  console.log("Видаляю старого адміна...");
  
  await client.execute({
    sql: "DELETE FROM users WHERE email = ?",
    args: ["admin@crm.com"],
  });
  
  const password = "admin123";
  const hash = await bcrypt.hash(password, 10);
  
  console.log("Новий hash:", hash);
  
  await client.execute({
    sql: "INSERT INTO users (id, name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [randomUUID(), "Адміністратор", "admin@crm.com", hash, "ADMIN", new Date().toISOString()],
  });
  
  const result = await client.execute({
    sql: "SELECT id, name, email, role, password FROM users WHERE email = ?",
    args: ["admin@crm.com"],
  });
  
  console.log("Користувач:", result.rows[0]);
  
  const isValid = await bcrypt.compare(password, String(result.rows[0].password));
  console.log("Перевірка пароля:", isValid);
}

resetAdmin()
  .then(() => {
    console.log("✅ Готово! Спробуй увійти: admin@crm.com / admin123");
    process.exit(0);
  })
  .catch((e) => {
    console.error("Помилка:", e);
    process.exit(1);
  });
