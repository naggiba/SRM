const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const path = require("path");

const dbPath = path.join(__dirname, "..", "crm.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'VIEWER',
    created_at TEXT NOT NULL
  )
`);

const existing = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@crm.com");

if (existing) {
  console.log("Admin вже існує. Пропускаємо.");
} else {
  const hash = bcrypt.hashSync("admin123", 10);
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO users (id, name, email, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, "Адміністратор", "admin@crm.com", hash, "ADMIN", now);
  console.log("✓ Admin створено:");
  console.log("  Email:  admin@crm.com");
  console.log("  Пароль: admin123");
  console.log("  Змініть пароль після першого входу!");
}

db.close();
