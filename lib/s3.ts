import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Cloudflare R2 — S3-сумісне сховище
const endpoint = process.env.S3_ENDPOINT;
const accessKeyId = process.env.S3_ACCESS_KEY_ID;
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
const bucket = process.env.S3_BUCKET_NAME;
const publicUrl = process.env.S3_PUBLIC_URL;

export const s3Client = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint,
  credentials: {
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
  },
  forcePathStyle: true, // R2 вимагає path-style запити
});

// Публічний URL для ключа обʼєкта
export function getPublicUrl(key: string): string {
  // Якщо задано публічний домен/кастомний домен
  if (publicUrl) return `${publicUrl.replace(/\/$/, "")}/${key}`;
  // Інакше будуємо з endpoint (для публічних bucket)
  return `${endpoint}/${bucket}/${key}`;
}

// Завантажує обʼєкт у R2 та повертає публічний URL
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return getPublicUrl(key);
}
