"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { normalizeImageForUpload } from "@/lib/compress";
import { uploadFile, type UploadResult } from "@/lib/upload-helper";

interface NotePhoto {
  url: string;        // оригінал — повноякісний
  previewUrl: string; // стиснений preview для UI
}

interface NoteData {
  id: string;
  title: string;
  content: string | null;
  photos: NotePhoto[];
  pinned: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Нормалізація фото: підтримуємо старі записи, де photos були просто рядками
function normalizePhoto(p: string | NotePhoto): NotePhoto {
  if (typeof p === "string") return { url: p, previewUrl: p };
  return { url: p.url, previewUrl: p.previewUrl ?? p.url };
}

// Завантаження оригіналу (з fallback на відкриття у новій вкладці)
async function downloadOriginal(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, "_blank");
  }
}

export default function NotesPage({ canEdit }: { canEdit: boolean }) {
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editNote, setEditNote] = useState<NoteData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/notes");
        if (!res.ok) throw new Error("Помилка завантаження");
        const data = await res.json();
        if (!cancelled) {
          setNotes(
            data.map((n: NoteData) => ({
              ...n,
              photos: (n.photos ?? []).map(normalizePhoto),
            }))
          );
        }
      } catch {
        if (!cancelled) setError("Не вдалося завантажити нотатки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Видалити нотатку?")) return;
    setLoading(true);
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) setNotes((p) => p.filter((n) => n.id !== id));
    else setError("Помилка видалення");
    setLoading(false);
  }

  async function handleTogglePin(note: NoteData) {
    const res = await fetch(`/api/notes/${note.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !note.pinned }),
    });
    if (res.ok) {
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? { ...n, pinned: n.pinned ? 0 : 1 } : n))
      );
    }
  }

  function handleEdit(note: NoteData) {
    setEditNote(note);
    setShowForm(true);
  }

  function handleCreate() {
    setEditNote(null);
    setShowForm(true);
  }

  function handleSaved(note: NoteData) {
    setNotes((prev) => {
      const exists = prev.find((n) => n.id === note.id);
      if (exists) return prev.map((n) => (n.id === note.id ? note : n));
      return [note, ...prev];
    });
    setShowForm(false);
    setEditNote(null);
  }

  async function handleAddPhoto(noteId: string, photo: NotePhoto) {
    const current = notes.find((n) => n.id === noteId);
    if (!current) return;
    const photos = [...(current.photos ?? []), photo];
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, photos } : n)));
    await fetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos }),
    });
  }

  async function handleRemovePhoto(noteId: string, index: number) {
    const current = notes.find((n) => n.id === noteId);
    if (!current) return;
    const photos = (current.photos ?? []).filter((_, i) => i !== index);
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, photos } : n)));
    await fetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos }),
    });
  }

  const filtered = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.content && n.content.toLowerCase().includes(search.toLowerCase()))
  );

  const pinned = filtered.filter((n) => n.pinned);
  const unpinned = filtered.filter((n) => !n.pinned);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400 text-sm">Завантаження...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-6">
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук нотаток..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
        </div>

        {canEdit && (
          <button
            onClick={handleCreate}
            className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            + Нова нотатка
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-500 text-sm mb-4 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}

      {showForm && (
        <NoteForm
          note={editNote}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditNote(null); }}
        />
      )}

      {pinned.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Закріплені
          </h3>
          <div className="space-y-2">
            {pinned.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                expanded={expanded === note.id}
                onToggle={() => setExpanded(expanded === note.id ? null : note.id)}
                onEdit={() => handleEdit(note)}
                onDelete={() => handleDelete(note.id)}
                onTogglePin={() => handleTogglePin(note)}
                onAddPhoto={handleAddPhoto}
                onRemovePhoto={handleRemovePhoto}
                canEdit={canEdit}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        {pinned.length > 0 && unpinned.length > 0 && (
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Усі нотатки
          </h3>
        )}
        <div className="space-y-2">
          {unpinned.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              expanded={expanded === note.id}
              onToggle={() => setExpanded(expanded === note.id ? null : note.id)}
              onEdit={() => handleEdit(note)}
              onDelete={() => handleDelete(note.id)}
              onTogglePin={() => handleTogglePin(note)}
              onAddPhoto={handleAddPhoto}
              onRemovePhoto={handleRemovePhoto}
              canEdit={canEdit}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          {search ? "Нічого не знайдено" : "Нотаток ще немає"}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">Усього: {notes.length}</p>
    </div>
  );
}

function NoteCard({
  note,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onTogglePin,
  onAddPhoto,
  onRemovePhoto,
  canEdit,
}: {
  note: NoteData;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onAddPhoto: (noteId: string, photo: NotePhoto) => void;
  onRemovePhoto: (noteId: string, index: number) => void;
  canEdit: boolean;
}) {
  const date = new Date(note.updatedAt || note.createdAt).toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleInsertPhoto = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      input.value = ""; // iOS: скидаємо, щоб можна було обрати наступне фото
      if (!file) return;
      setUploading(true);
      setUploadError("");
      try {
        const original = await normalizeImageForUpload(file);
        const result: UploadResult = await uploadFile(original);
        onAddPhoto(note.id, { url: result.originalUrl, previewUrl: result.previewUrl });
      } catch (err) {
        console.error("Помилка завантаження фото:", err);
        setUploadError("Не вдалося завантажити фото. Спробуйте ще раз.");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition">
      <div className="px-4 py-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {note.pinned ? (
                <svg className="w-4 h-4 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                </svg>
              ) : null}
              <h4 className="font-medium text-gray-800 truncate">{note.title}</h4>
            </div>
            {note.content && !expanded && (
              <p className="text-sm text-gray-500 truncate mt-1">{note.content}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400">{date}</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {note.content && (
            <div className="text-sm text-gray-700 whitespace-pre-wrap mb-3">{note.content}</div>
          )}

          {note.photos && note.photos.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {note.photos.map((photo, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <Image
                      src={photo.previewUrl}
                      alt={`Фото ${i + 1}`}
                      width={100}
                      height={100}
                      className="object-cover rounded-lg border border-gray-200"
                    />
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemovePhoto(note.id, i); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs leading-none flex items-center justify-center shadow"
                        title="Видалити фото"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const filename = `note-${note.id}-photo-${i + 1}.jpg`;
                      downloadOriginal(photo.url, filename);
                    }}
                    className="text-[11px] text-blue-600 hover:text-blue-800 transition"
                    title="Завантажити оригінал"
                  >
                    Завантажити оригінал
                  </a>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-3">
              {uploadError}
            </p>
          )}

          {canEdit && (
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              {note.pinned ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                  className="text-xs text-gray-500 hover:text-yellow-600 transition"
                >
                  Відкріпити
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                  className="text-xs text-gray-500 hover:text-yellow-600 transition"
                >
                  Закріпити
                </button>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); handleInsertPhoto(); }}
                disabled={uploading}
                className="text-xs text-gray-500 hover:text-blue-600 transition flex items-center gap-1 disabled:opacity-50"
                title="Додати фото"
              >
                {uploading ? (
                  <span>Завантаження...</span>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Додати
                  </>
                )}
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="text-xs text-blue-600 hover:text-blue-800 transition"
              >
                Редагувати
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-xs text-red-500 hover:text-red-700 transition"
              >
                Видалити
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoteForm({
  note,
  onSaved,
  onCancel,
}: {
  note: NoteData | null;
  onSaved: (n: NoteData) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [photos, setPhotos] = useState<NotePhoto[]>((note?.photos ?? []).map(normalizePhoto));
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleAddFormPhoto() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      input.value = ""; // iOS: скидаємо, щоб можна було обрати наступне фото
      if (!file) return;
      setUploading(true);
      try {
        const original = await normalizeImageForUpload(file);
        const result: UploadResult = await uploadFile(original);
        setPhotos((prev) => [...prev, { url: result.originalUrl, previewUrl: result.previewUrl }]);
      } catch (err) {
        console.error("Помилка завантаження фото:", err);
        setError("Не вдалося завантажити фото");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body = { title, content, photos };
    const res = note
      ? await fetch(`/api/notes/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Помилка збереження");
      return;
    }

    const saved = await res.json();
    onSaved({
      id: saved.id ?? note?.id ?? "",
      title,
      content: content || null,
      photos,
      pinned: note?.pinned ?? 0,
      createdAt: note?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: note?.createdBy ?? "",
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
      <h2 className="font-semibold text-gray-800 mb-4">
        {note ? "Редагувати нотатку" : "Нова нотатка"}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Назва <span className="text-red-500">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Назва нотатки"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Текст
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Текст нотатки..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
          />

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Фото
          </label>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {photos.map((photo, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <Image
                      src={photo.previewUrl}
                      alt={`Фото ${i + 1}`}
                      width={100}
                      height={100}
                      className="object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs leading-none flex items-center justify-center shadow"
                      title="Видалити фото"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadOriginal(photo.url, `note-photo-${i + 1}.jpg`)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 transition"
                  >
                    Завантажити оригінал
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleAddFormPhoto}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 transition disabled:opacity-50"
          >
            {uploading ? (
              <span>Завантаження...</span>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Додати фото
              </>
            )}
          </button>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
          >
            Скасувати
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Збереження..." : "Зберегти"}
          </button>
        </div>
      </form>
    </div>
  );
}
