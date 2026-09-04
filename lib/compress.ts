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

// HEIC визначаємо і за типом, і за розширенням — iOS інколи не передає file.type
function isHeicFile(file: File): boolean {
  if (HEIC_TYPES.includes(file.type)) return true;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return ext === "heic" || ext === "heif";
}

// Конвертує HEIC/HEIF у JPEG — кілька стратегій, щоб гарантовано працювати
// на iPhone (де фото у HEIC/HEVC, які sharp на сервері не завжди декодує).
async function convertHeicToJpeg(file: File): Promise<File> {
  const jpgName = file.name.replace(/\.[^.]+$/, ".jpg");

  // 1) heic2any (WASM)
  try {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.85,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    return new File([blob], jpgName, { type: "image/jpeg" });
  } catch (e) {
    console.warn("heic2any failed, fallback to canvas:", e);
  }

  // 2) Декодування через <img> + canvas (iOS вміє показувати HEIC)
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Не вдалося декодувати зображення"));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    canvas.getContext("2d")?.drawImage(img, 0, 0);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (blob) return new File([blob], jpgName, { type: "image/jpeg" });
  } catch (e) {
    console.warn("canvas decode failed:", e);
  } finally {
    URL.revokeObjectURL(url);
  }

  // 3) Якщо нічого не вийшло — повертаємо оригінал, сервер спробує сам
  return file;
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // HEIC/HEIF не декодуються у canvas на iOS — конвертуємо у JPEG спочатку
    if (isHeicFile(file)) {
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
    if (isHeicFile(file)) {
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
