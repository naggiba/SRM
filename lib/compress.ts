import imageCompression from "browser-image-compression";

export interface CompressionOptions {
  maxSizeMB?: number;       // максимальний розмір в MB
  maxWidthOrHeight?: number; // максимальна ширина або висота
  quality?: number;         // якість 0-1
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: 0.15,          // 150 KB — максимальне стиснення
  maxWidthOrHeight: 800,    // 800px — достатньо для перегляду в CRM
  quality: 0.6,             // 60% якості — гарний баланс
};

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Пропускаємо якщо файл вже маленький
  if (file.size < (opts.maxSizeMB! * 1024 * 1024)) {
    // Але все одно зменшимо розміри якщо потрібно
    if (file.size < 100 * 1024) { // менше 100KB — не чіпаємо
      return file;
    }
  }

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: opts.maxSizeMB!,
      maxWidthOrHeight: opts.maxWidthOrHeight!,
      useWebWorker: true,
      fileType: "image/webp", // конвертуємо в webp для ще кращого стиснення
    });

    // Повертаємо як File з правильним ім'ям
    const newName = file.name.replace(/\.[^.]+$/, ".webp");
    return new File([compressedFile], newName, { type: "image/webp" });
  } catch (error) {
    console.error("Помилка стиснення:", error);
    return file; // повертаємо оригінал якщо не вдалося стиснути
  }
}

// Форматування розміру файлу
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
