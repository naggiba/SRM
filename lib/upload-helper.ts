// Універсальний helper для завантаження файлів
// Використовує Uploadthing на продакшені або локальний upload для розробки

const useUploadthing = typeof window !== "undefined" && !!process.env.NEXT_PUBLIC_UPLOADTHING_TOKEN;

export async function uploadFile(file: File): Promise<string> {
  if (useUploadthing) {
    // Uploadthing (продакшен)
    const formData = new FormData();
    formData.append("files", file);
    
    const res = await fetch("/api/uploadthing", {
      method: "POST",
      body: formData,
    });
    
    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || "Помилка завантаження");
    }
    
    const data = await res.json();
    return data[0]?.url || data.url;
  } else {
    // Локальний upload (розробка)
    const fd = new FormData();
    fd.append("file", file);
    
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error ?? "Помилка завантаження");
    }
    
    return data.path;
  }
}
