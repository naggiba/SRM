import type { NextConfig } from "next";

// Парсимо кастомний публічний домен R2 (якщо валідний)
function getR2Hostname(): string | null {
  const url = process.env.S3_PUBLIC_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const nextConfig: NextConfig = {
  // Виключаємо better-sqlite3 з серверного бандлу на Vercel
  serverExternalPackages: ["better-sqlite3"],

  images: {
    // Дозволяємо зображення з Uploadthing та Cloudflare R2
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.ufs.sh",
      },
      {
        protocol: "https",
        hostname: "uploadthing.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      // Кастомний публічний домен R2 (якщо задано S3_PUBLIC_URL)
      ...(getR2Hostname()
        ? [{
            protocol: "https" as const,
            hostname: getR2Hostname()!,
          }]
        : []),
    ],
    // Мінімальний TTL кешу зображень — 1 день
    minimumCacheTTL: 86400,
  },

  // HTTP заголовки для кешування статичних ресурсів
  async headers() {
    return [
      {
        // Кешуємо статичні файли (фото uploads) на 30 днів
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, immutable",
          },
        ],
      },
      {
        // API не кешуємо
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
