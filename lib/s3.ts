import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Cloudflare R2 — S3-сумісне сховище
const endpoint = (process.env.S3_ENDPOINT ?? "").trim();
const accessKeyId = (process.env.S3_ACCESS_KEY_ID ?? "").trim();
const secretAccessKey = (process.env.S3_SECRET_ACCESS_KEY ?? "").trim();
const bucket = (process.env.S3_BUCKET_NAME ?? "").trim();
const publicUrl = (process.env.S3_PUBLIC_URL ?? "").trim();

let client: S3Client | null = null;

// Створюємо S3-клієнт з валідацією, щоб давати зрозумілу помилку замість
// криптичного повідомлення AWS SDK ("The string did not match the expected pattern").
function getClient(): S3Client {
  if (client) return client;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "Cloudflare R2 не налаштовано. Додайте у .env: S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME"
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("S3_ENDPOINT не є коректним URL. Приклад: https://<account>.r2.cloudflarestorage.com");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("S3_ENDPOINT має використовувати http(s).");
  }
  if (bucket.length < 3 || bucket.length > 63) {
    throw new Error("S3_BUCKET_NAME має бути від 3 до 63 символів.");
  }

  client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // R2 вимагає path-style запити
  });
  return client;
}

// Публічний URL для ключа обʼєкта
export function getPublicUrl(key: string): string {
  const base = publicUrl
    ? publicUrl.replace(/\/$/, "")
    : `${endpoint}/${bucket}`;
  return `${base}/${key}`;
}

// Завантажує обʼєкт у R2 та повертає публічний URL
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return getPublicUrl(key);
}
