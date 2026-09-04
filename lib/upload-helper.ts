// Універсальний helper для завантаження файлів
// Завантажує файл через /api/upload (Cloudflare R2), повертає { originalUrl, previewUrl }

export interface UploadResult {
  originalUrl: string;
  previewUrl: string;
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? "Помилка завантаження");
  }

  return {
    originalUrl: data.originalUrl ?? data.path,
    previewUrl: data.previewUrl ?? data.originalUrl ?? data.path,
  };
}
