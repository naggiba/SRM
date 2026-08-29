import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Виключаємо better-sqlite3 з серверного бандлу на Vercel
  serverExternalPackages: ["better-sqlite3"],

  images: {
    // Дозволяємо зображення з Uploadthing та локальних uploads
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.ufs.sh",
      },
      {
        protocol: "https",
        hostname: "uploadthing.com",
      },
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
