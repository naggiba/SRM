import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, Product } from "@/lib/schema";
import { eq, like, or } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET /api/products — список з пошуком
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";

  let list: Product[];
  if (q) {
    list = await db.select().from(products).where(
      or(
        like(products.modelNumber, `%${q}%`),
        like(products.supplier, `%${q}%`)
      )
    );
  } else {
    list = await db.select().from(products);
  }

  return NextResponse.json(list);
}

// POST /api/products — створити або оновити якщо модель вже існує
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const body = await req.json();
  const { modelNumber, photoPath, supplier, price, note } = body;

  if (!modelNumber?.trim()) {
    return NextResponse.json({ error: "Номер моделі обов'язковий" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Перевіряємо чи вже існує така модель
  const [existing] = await db.select().from(products)
    .where(eq(products.modelNumber, modelNumber.trim()))
    .limit(1);

  if (existing) {
    // Оновлюємо якщо є нові дані (фото, ціна)
    const updateData: Partial<Product> = { updatedAt: now };
    if (photoPath && !existing.photoPath) updateData.photoPath = photoPath;
    if (price && price !== existing.price) updateData.price = price;
    if (supplier && supplier !== existing.supplier) updateData.supplier = supplier;
    if (note) updateData.note = note;

    await db.update(products).set(updateData).where(eq(products.id, existing.id));
    const [updated] = await db.select().from(products).where(eq(products.id, existing.id));
    return NextResponse.json(updated, { status: 200 });
  }

  // Створюємо новий
  const id = randomUUID();
  await db.insert(products).values({
    id,
    modelNumber: modelNumber.trim(),
    photoPath: photoPath ?? null,
    supplier: supplier?.trim() ?? null,
    price: price?.trim() ?? null,
    note: note?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(products).where(eq(products.id, id));
  return NextResponse.json(created, { status: 201 });
}
