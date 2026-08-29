import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function check() {
  const result = await client.execute("SELECT id, email, role, password FROM users");
  console.log("Users in Turso DB:");
  for (const row of result.rows) {
    console.log("  email:", row.email, "| role:", row.role);
    console.log("  password hash:", row.password);
    const valid = await bcrypt.compare("admin123", String(row.password));
    console.log("  bcrypt check 'admin123':", valid);
  }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
