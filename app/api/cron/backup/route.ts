import { NextRequest, NextResponse } from "next/server";
import { runFullBackup } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // секунд (Vercel Hobby = 60s max)

export async function GET(req: NextRequest) {
  // Захист: Vercel Cron шле Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runFullBackup();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Backup failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
