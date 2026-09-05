import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["ADMIN", "MANAGER", "VIEWER"] })
    .notNull()
    .default("VIEWER"),
  createdAt: text("created_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = "ADMIN" | "MANAGER" | "VIEWER";

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  telegram: text("telegram"),
  cargoCode: text("cargo_code"),
  createdAt: text("created_at").notNull(),
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

// ── Orders ──────────────────────────────────────────────────────────────────

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  clientId: text("client_id"),
  clientName: text("client_name"),
  note: text("note"),
  totalPrice: text("total_price"),
  supplierTotal: text("supplier_total"),     // сума до оплати постачальнику
  clientPaid: text("client_paid"),
  wePaid: text("we_paid"),
  deliveryType: text("delivery_type", { enum: ["AIR", "RAIL"] }),
  estimatedShipDate: text("estimated_ship_date"),  // формат "DD.MM"
  orderDate: text("order_date"),                   // дата замовлення "DD.MM"
  cargoPhotoPath: text("cargo_photo_path"),
  status: text("status", {
    enum: ["WAITING_PAYMENT", "CLIENT_PAID", "ORDERED", "SENT_TO_CARGO"],
  })
    .notNull()
    .default("WAITING_PAYMENT"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  photoPath: text("photo_path"),
  supplier: text("supplier"),
  modelNumber: text("model_number"),
  price: text("price"),
  colors: text("colors"),               // JSON: [{ color: "red", qty: 10 }, ...]
  status: text("status"),               // окремий статус частини (якщо null — наслідує статус замовлення)
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── Payments (оплати з фото) ────────────────────────────────────────────────

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  type: text("type", { enum: ["CLIENT", "SUPPLIER"] }).notNull(),
  amount: text("amount").notNull(),
  currency: text("currency", { enum: ["CNY", "UAH"] }).notNull().default("CNY"),
  exchangeRate: text("exchange_rate"),   // курс грн/юань якщо currency=UAH
  photoPath: text("photo_path"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;

// ── Extra Expenses (додаткові витрати) ───────────────────────────────────────

export const extraExpenses = sqliteTable("extra_expenses", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  description: text("description").notNull(),  // назва витрати
  amount: text("amount").notNull(),             // сума в грн
  createdAt: text("created_at").notNull(),
});

export type ExtraExpense = typeof extraExpenses.$inferSelect;

// ── Products (каталог товарів) ───────────────────────────────────────────────

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  modelNumber: text("model_number").notNull().unique(), // унікальний номер моделі
  photoPath: text("photo_path"),             // головне фото (для сумісності)
  photoPaths: text("photo_paths"),           // JSON: [{ url, previewUrl }, ...]
  supplier: text("supplier"),
  price: text("price"),
  note: text("note"),
  tags: text("tags"),                        // JSON: ["штани", "костюми", ...]
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// Фото товару
export interface ProductPhoto {
  url: string;        // оригінал — повноякісний
  previewUrl: string; // стиснений preview для UI
}

// ── Withdrawals (виплати — вивід зароблених коштів) ──────────────────────────

export const withdrawalCategories = sqliteTable("withdrawal_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const withdrawals = sqliteTable("withdrawals", {
  id: text("id").primaryKey(),
  categoryId: text("category_id"),
  categoryName: text("category_name").notNull(),
  amount: text("amount").notNull(),      // сума в ¥
  note: text("note"),
  createdAt: text("created_at").notNull(),
  createdBy: text("created_by").notNull(),
});

export type WithdrawalCategory = typeof withdrawalCategories.$inferSelect;
export type Withdrawal = typeof withdrawals.$inferSelect;

// ── Notes (нотатки / блокнот) ────────────────────────────────────────────────

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content"),
  photos: text("photos"),              // JSON: ["url1", "url2", ...]
  pinned: integer("pinned").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdBy: text("created_by").notNull(),
});

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

// Типи для кольорів
export interface ColorQty {
  color: string;
  qty: number;
}
