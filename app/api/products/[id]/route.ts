import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/schema";
import { eq } from "drizzle-orm";

// PATCH /api/products/[id] — оновити товар
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { modelNumber, photoPath, supplier, price, note } = body;

  await db.update(products).set({
    ...(modelNumber && { modelNumber: modelNumber.trim() }),
    ...(photoPath !== undefined && { photoPath }),
    ...(supplier !== undefined && { supplier: supplier?.trim() ?? null }),
    ...(price !== undefined && { price: price?.trim() ?? null }),
    ...(note !== undefined && { note: note?.trim() ?? null }),
    updatedAt: new Date().toISOString(),
  }).where(eq(products.id, id));

  const [updated] = await db.select().from(products).where(eq(products.id, id));
  if (!updated) return NextResponse.json({ error: "Не знайдено" }, { status: 404 });

  return NextResponse.json(updated);
}

// DELETE /api/products/[id] — видалити товар
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Тільки адміністратор" }, { status: 403 });
  }

  const { id } = await params;
  await db.delete(products).where(eq(products.id, id));
  return NextResponse.json({ ok: true });
}
