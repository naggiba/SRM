import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { withdrawals } from "@/lib/schema";
import { eq } from "drizzle-orm";

// DELETE /api/withdrawals/[id] — видалити виплату
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { id } = await params;
  await db.delete(withdrawals).where(eq(withdrawals.id, id));
  return NextResponse.json({ ok: true });
}
