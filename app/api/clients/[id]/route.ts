import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";

// PATCH /api/clients/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { id } = await params;
  const { name, telegram, cargoCode } = await req.json();
  const updates: Record<string, string | null> = {};

  if (name !== undefined) updates.name = name.trim();
  if (telegram !== undefined) updates.telegram = telegram?.trim() || null;
  if (cargoCode !== undefined) updates.cargoCode = cargoCode?.trim() || null;

  await db.update(clients).set(updates).where(eq(clients.id, id));

  const [updated] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!updated) return NextResponse.json({ error: "Не знайдено" }, { status: 404 });

  return NextResponse.json(updated);
}

// DELETE /api/clients/[id] (admin only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { id } = await params;
  await db.delete(clients).where(eq(clients.id, id));
  return NextResponse.json({ ok: true });
}
