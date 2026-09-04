import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { uploadToS3 } from "@/lib/s3";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/avif"];
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
};

// Визначаємо надійний MIME-тип: спочатку file.type, інакше за розширенням файлу.
// iOS іноді передає порожній/nекоректний content-type — через це AWS SDK
// кидає "The string did not match the expected pattern".
function resolveMime(file: File, ext: string): string {
  const t = (file.type || "").trim().toLowerCase();
  if (/^image\/[a-z0-9.+-]+$/.test(t)) return t;
  return EXT_MIME[ext] ?? "image/jpeg";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role === "VIEWER") {
    return NextResponse.json({ error: "Доступ заборонено" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Файл не знайдено" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Максимальний розмір файлу — 20 МБ" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const mime = resolveMime(file, ext);

  if (!ALLOWED_TYPES.includes(mime)) {
    return NextResponse.json({ error: "Дозволені лише зображення (jpg, png, webp, gif, heic)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `${randomUUID()}.${ext}`;

    // 1. Оригінал — без змін, напряму в R2
    const originalUrl = await uploadToS3(key, buffer, mime);

    // 2. Preview — стискаємо через sharp (WebP, max 800px, quality 80%)
    let previewUrl = originalUrl;
    try {
      const previewKey = `${key}_preview.webp`;
      const previewBuffer = await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      previewUrl = await uploadToS3(previewKey, previewBuffer, "image/webp");
    } catch (err) {
      console.error("Помилка генерації preview:", err);
    }

    return NextResponse.json({ path: originalUrl, originalUrl, previewUrl }, { status: 201 });
  } catch (e) {
    console.error("R2 upload error:", e);
    const name = e instanceof Error ? e.name : "";
    const code = (e as { Code?: string })?.Code ?? "";
    // Повертаємо зрозумілу причину, але без секретних деталей
    return NextResponse.json(
      { error: `Помилка завантаження (${code || name || "сервер"})` },
      { status: 500 }
    );
  }
}
