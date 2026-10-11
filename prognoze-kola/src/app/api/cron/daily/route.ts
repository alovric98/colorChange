import { NextResponse } from "next/server";
import { LEAGUES } from "@/config/leagues";
import { isCronAuthorized } from "@/lib/auth";
import { zagrebDate, zagrebHour } from "@/lib/dates";
import { enqueueAnalysis, kickProcessing } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Dnevni cron u 08:00 po Zagrebu. Vercel Cron radi u UTC-u, pa su zakazana
 * dva okidača (06:00 i 07:00 UTC); izvršava se samo onaj koji pada u 8 h
 * lokalnog vremena (ljetno/zimsko). ?force=1 preskače provjeru sata.
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  if (zagrebHour() !== 8 && url.searchParams.get("force") !== "1") {
    return NextResponse.json({ skipped: true, reason: "Nije 08 h po Zagrebu." });
  }

  const today = zagrebDate();
  const results = await Promise.all(
    LEAGUES.map(async (league) => {
      try {
        const { row, started } = await enqueueAnalysis(league.key, today);
        // Svaka liga se obrađuje u svojoj invokaciji.
        if (started) await kickProcessing(row.id, url.origin);
        return { league: league.key, status: row.status, started };
      } catch (err) {
        return { league: league.key, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );
  return NextResponse.json({ date: today, results });
}
