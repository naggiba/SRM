import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { notes, Note } from "@/lib/schema";
import { desc } from "drizzle-orm";
import { randomUUID } from "crypto";

// GET /api/notes — list all notes
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизовано" }, { status: 401 });

  const allNotes: Note[] = await db.select().from(notes).orderBy(desc(notes.createdAt));

  const result = allNotes.map((n: Note) => ({
    ...n,
    photos: n.photos ? JSON.parse(n.photos) : [],
  }));

  return NextResponse.json(result);
}

// POST /api/notes — create note
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id ?? "";

  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const body = await req.json();
  const { title, content, photos, pinned } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Назва обов'язкова" }, { status: 400 });
  }

  const noteId = randomUUID();
  const now = new Date().toISOString();

  await db.insert(notes).values({
    id: noteId,
    title: title.trim(),
    content: content?.trim() || null,
    photos: Array.isArray(photos) ? JSON.stringify(photos) : null,
    pinned: pinned ? 1 : 0,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  });

  return NextResponse.json({ id: noteId }, { status: 201 });
}
