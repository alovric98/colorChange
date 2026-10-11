import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getLeague } from "@/config/leagues";
import { isSelectableDay } from "@/lib/dates";
import { isPasswordAuthorized } from "@/lib/auth";
import { enqueueAnalysis, kickProcessing, runJob, STALE_MS } from "@/lib/jobs";
import { getAnalysis, getProgress } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Status analize za ligu i dan (klijent ga periodički provjerava). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const league = getLeague(url.searchParams.get("league"));
  const date = url.searchParams.get("date");
  if (!league) return badRequest("Nepoznata liga.");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return badRequest("Neispravan datum.");

  const row = await getAnalysis(league.key, date);
  if (!row) return NextResponse.json({ status: "none" });

  const inProgress = row.status === "queued" || row.status === "working";
  if (inProgress && Date.now() - row.updatedAt.getTime() > STALE_MS) {
    // Posao je zapeo (npr. prekinuta invokacija) – pokreni nastavak.
    after(() => kickProcessing(row.id, url.origin));
  }
  const progress = await getProgress(row.id);
  return NextResponse.json({
    status: row.status,
    error: row.error,
    updatedAt: row.updatedAt.toISOString(),
    done: progress.done,
    total: row.matchCount ?? progress.total,
  });
}

const PostBody = z.object({
  league: z.string(),
  date: z.string(),
  refresh: z.boolean().optional(),
});

/** Pokreće (ili osvježava) analizu kao pozadinski posao. Zaštićeno lozinkom. */
export async function POST(req: Request) {
  if (!isPasswordAuthorized(req)) {
    return NextResponse.json({ error: "Pogrešna lozinka." }, { status: 401 });
  }
  const body = PostBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return badRequest("Neispravan zahtjev.");
  const league = getLeague(body.data.league);
  if (!league) return badRequest("Nepoznata liga.");
  if (!isSelectableDay(body.data.date)) return badRequest("Dan mora biti danas ili do 6 dana unaprijed.");

  const { row, started } = await enqueueAnalysis(league.key, body.data.date, { refresh: body.data.refresh });
  if (started) {
    const origin = new URL(req.url).origin;
    after(() => runJob(row.id, origin));
  }
  return NextResponse.json({ status: row.status, started }, { status: 202 });
}
