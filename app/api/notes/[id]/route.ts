import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notes, Note } from "@/lib/schema";
import { eq } from "drizzle-orm";

// GET /api/notes/[id] — get single note
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });

  const { id } = await params;
  const result: Note[] = await db.select().from(notes).where(eq(notes.id, id));

  if (result.length === 0) {
    return NextResponse.json({ error: "Нотатку не знайдено" }, { status: 404 });
  }

  const note = result[0];
  return NextResponse.json({
    ...note,
    photos: note.photos ? JSON.parse(note.photos) : [],
  });
}

// PUT /api/notes/[id] — update note
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { title, content, photos, pinned } = body;

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (title !== undefined) updates.title = title?.trim() || null;
  if (content !== undefined) updates.content = content?.trim() || null;
  if (photos !== undefined) updates.photos = Array.isArray(photos) ? JSON.stringify(photos) : null;
  if (pinned !== undefined) updates.pinned = pinned ? 1 : 0;

  await db.update(notes).set(updates).where(eq(notes.id, id));

  return NextResponse.json({ success: true });
}

// DELETE /api/notes/[id] — delete note
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || (role !== "ADMIN" && role !== "MANAGER")) {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const { id } = await params;
  await db.delete(notes).where(eq(notes.id, id));

  return NextResponse.json({ success: true });
}
