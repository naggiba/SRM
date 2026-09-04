import imageCompression from "browser-image-compression";

export interface CompressionOptions {
  maxSizeMB?: number;       // максимальний розмір в MB
  maxWidthOrHeight?: number; // максимальна ширина або висота
  quality?: number;         // якість 0-1
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: 0.5,           // 500 KB — баланс розміру та якості
  maxWidthOrHeight: 1280,   // 1280px — достатньо для перегляду в CRM
  quality: 0.7,             // 70% якості
};

const HEIC_TYPES = ["image/heic", "image/heif"];

// Конвертує HEIC/HEIF у JPEG за допомогою heic2any (тільки в браузері)
async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.8,
  });
  const blob = Array.isArray(result) ? result[0] : result;
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // HEIC/HEIF не декодуються у canvas на iOS — конвертуємо у JPEG спочатку
    if (HEIC_TYPES.includes(file.type)) {
      file = await convertHeicToJpeg(file);
    }
  } catch (error) {
    console.error("Помилка конвертації HEIC:", error);
    // Якщо конвертація не вдалась — повертаємо оригінал, сервер прийме його
    return file;
  }

  // Пропускаємо якщо файл вже маленький
  if (file.size < 100 * 1024) {
    return file;
  }

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: opts.maxSizeMB!,
      maxWidthOrHeight: opts.maxWidthOrHeight!,
      useWebWorker: false, // надійніше на мобільних пристроях
      fileType: "image/jpeg", // JPEG підтримується всюди
      initialQuality: opts.quality,
    });

    const newName = file.name.replace(/\.[^.]+$/, ".jpg");
    return new File([compressedFile], newName, { type: "image/jpeg" });
  } catch (error) {
    console.error("Помилка стиснення:", error);
    return file;
  }
}

// Підготовка оригіналу для завантаження в R2:
// конвертуємо лише HEIC -> JPEG (щоб сервер/sharp зміг обробити),
// БЕЗ зменшення роздільності — оригінал залишається повноякісним.
export async function normalizeImageForUpload(file: File): Promise<File> {
  try {
    if (HEIC_TYPES.includes(file.type)) {
      return await convertHeicToJpeg(file);
    }
    return file;
  } catch (error) {
    console.error("Помилка конвертації HEIC:", error);
    return file;
  }
}

// Форматування розміру файлу
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
