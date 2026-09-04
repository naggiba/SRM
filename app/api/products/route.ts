import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, Product, ProductPhoto } from "@/lib/schema";
import { eq, like, or } from "drizzle-orm";
import { randomUUID } from "crypto";

// Серіалізація фото — парсимо JSON-рядок photoPaths у масив
function serializeProduct(p: Product) {
  let photoPaths: ProductPhoto[] = [];
  if (p.photoPaths) {
    try { photoPaths = JSON.parse(p.photoPaths); } catch { photoPaths = []; }
  }
  return { ...p, photoPaths };
}

// Головне фото = перший елемент масиву
function mainPhoto(photoPaths: ProductPhoto[] | undefined): string | null {
  return Array.isArray(photoPaths) && photoPaths.length > 0 ? photoPaths[0].url : null;
}

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

  return NextResponse.json(list.map(serializeProduct));
}

// POST /api/products — створити або оновити якщо модель вже існує
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const body = await req.json();
  const { modelNumber, photoPath, photoPaths, supplier, price, note } = body;

  if (!modelNumber?.trim()) {
    return NextResponse.json({ error: "Номер моделі обов'язковий" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const photoPathsJson = Array.isArray(photoPaths) && photoPaths.length > 0
    ? JSON.stringify(photoPaths)
    : null;
  const mainPhotoUrl = mainPhoto(photoPaths) || photoPath || null;

  // Перевіряємо чи вже існує така модель
  const [existing] = await db.select().from(products)
    .where(eq(products.modelNumber, modelNumber.trim()))
    .limit(1);

  if (existing) {
    // Оновлюємо якщо є нові дані (фото, ціна)
    const updateData: Partial<Product> = { updatedAt: now };
    if (Array.isArray(photoPaths)) {
      updateData.photoPaths = photoPathsJson;
      updateData.photoPath = mainPhotoUrl;
    }
    if (price && price !== existing.price) updateData.price = price;
    if (supplier && supplier !== existing.supplier) updateData.supplier = supplier;
    if (note) updateData.note = note;

    await db.update(products).set(updateData).where(eq(products.id, existing.id));
    const [updated] = await db.select().from(products).where(eq(products.id, existing.id));
    return NextResponse.json(serializeProduct(updated), { status: 200 });
  }

  // Створюємо новий
  const id = randomUUID();
  await db.insert(products).values({
    id,
    modelNumber: modelNumber.trim(),
    photoPath: mainPhotoUrl,
    photoPaths: photoPathsJson,
    supplier: supplier?.trim() ?? null,
    price: price?.trim() ?? null,
    note: note?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(products).where(eq(products.id, id));
  return NextResponse.json(serializeProduct(created), { status: 201 });
}
