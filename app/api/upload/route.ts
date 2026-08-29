import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { UTApi } from "uploadthing/server";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// Визначаємо чи використовувати Uploadthing
const useUploadthing = !!process.env.UPLOADTHING_TOKEN;

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
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Дозволені лише зображення (jpg, png, webp, gif)" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Максимальний розмір файлу — 10 МБ" }, { status: 400 });
  }

  if (useUploadthing) {
    // Uploadthing (продакшен)
    try {
      const utapi = new UTApi();
      const response = await utapi.uploadFiles(file);
      
      if (response.error) {
        return NextResponse.json({ error: response.error.message }, { status: 500 });
      }
      
      return NextResponse.json({ path: response.data.ufsUrl }, { status: 201 });
    } catch (e) {
      console.error("Uploadthing error:", e);
      return NextResponse.json({ error: "Помилка завантаження на сервер" }, { status: 500 });
    }
  } else {
    // Локальний upload (розробка)
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");

    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    return NextResponse.json({ path: `/uploads/${filename}` }, { status: 201 });
  }
}
