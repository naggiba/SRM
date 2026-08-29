// Визначаємо чи використовувати Turso (продакшен) чи локальну SQLite (розробка)
const useTurso = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

// Динамічний експорт db в залежності від середовища
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

/* eslint-disable @typescript-eslint/no-require-imports */
if (useTurso) {
  // Turso (продакшен)
  const tursoModule = require("./db-turso");
  db = tursoModule.db;
} else {
  // Локальна SQLite (розробка)
  const localModule = require("./db-local");
  db = localModule.db;
}
/* eslint-enable @typescript-eslint/no-require-imports */

export { db };
