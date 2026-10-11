import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AnalysisStatus } from "@/db/schema";
import { getLeague } from "@/config/leagues";
import { appBaseUrl, requireEnv } from "@/lib/env";
import { collectDay } from "@/lib/analysis/collect";
import { analyseMatch } from "@/lib/analysis/claude";

const { analyses, matchAnalyses } = schema;

/** Ukupno vrijeme rada jedne serverless invokacije (maxDuration je 300 s). */
const INVOCATION_BUDGET_MS = 240_000;
/** Novu utakmicu ne počinji ako je ostalo manje od ovoga. */
const MIN_TIME_FOR_MATCH_MS = 110_000;
const CONCURRENCY = 3;
/** Posao koji se ovoliko dugo nije pomaknuo smatra se zapelim. */
export const STALE_MS = 6 * 60_000;

export type AnalysisRow = typeof analyses.$inferSelect;

/**
 * Stavlja analizu u red (ili je ponovno pokreće kod osvježavanja).
 * Ne duplicira posao koji je već u tijeku.
 */
export async function enqueueAnalysis(
  leagueKey: string,
  date: string,
  opts: { refresh?: boolean } = {},
): Promise<{ row: AnalysisRow; started: boolean }> {
  const [existing] = await db()
    .select()
    .from(analyses)
    .where(and(eq(analyses.leagueKey, leagueKey), eq(analyses.date, date)))
    .limit(1);

  if (existing) {
    const inProgress = existing.status === "queued" || existing.status === "working";
    const stale = Date.now() - existing.updatedAt.getTime() > STALE_MS;
    if (inProgress && !stale) return { row: existing, started: false };
    if (!opts.refresh && !inProgress && existing.status !== "error") return { row: existing, started: false };

    const [row] = await db()
      .update(analyses)
      .set({ status: "queued", error: null, matchCount: null, forceFresh: !!opts.refresh, updatedAt: new Date() })
      .where(eq(analyses.id, existing.id))
      .returning();
    return { row, started: true };
  }

  const [row] = await db()
    .insert(analyses)
    .values({ leagueKey, date, status: "queued" })
    .onConflictDoNothing()
    .returning();
  if (!row) {
    const [again] = await db()
      .select()
      .from(analyses)
      .where(and(eq(analyses.leagueKey, leagueKey), eq(analyses.date, date)))
      .limit(1);
    return { row: again, started: false };
  }
  return { row, started: true };
}

/** Pokreće obradu u novoj serverless invokaciji (rute same koriste after()). */
export async function kickProcessing(analysisId: number, origin?: string): Promise<void> {
  try {
    const res = await fetch(`${appBaseUrl(origin)}/api/jobs/process`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${requireEnv("CRON_SECRET")}` },
      body: JSON.stringify({ analysisId }),
      cache: "no-store",
    });
    if (!res.ok) console.error(`[jobs] nastavak posla ${analysisId} vratio HTTP ${res.status}`);
  } catch (err) {
    console.error(`[jobs] nastavak posla ${analysisId} nije uspio`, err);
  }
}

async function setStatus(id: number, status: AnalysisStatus, extra: Partial<AnalysisRow> = {}) {
  await db()
    .update(analyses)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(analyses.id, id));
}

/** Faza 1: atomarno preuzmi posao i prikupi podatke iz API-Footballa. */
async function prepare(row: AnalysisRow): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_MS);
  const claimed = await db()
    .update(analyses)
    .set({ status: "working", updatedAt: new Date() })
    .where(
      and(
        eq(analyses.id, row.id),
        sql`(${analyses.status} = 'queued' OR (${analyses.status} = 'working' AND ${analyses.matchCount} IS NULL AND ${analyses.updatedAt} < ${staleBefore.toISOString()}::timestamptz))`,
      ),
    )
    .returning({ id: analyses.id });
  if (claimed.length === 0) return false;

  const league = getLeague(row.leagueKey);
  if (!league) {
    await setStatus(row.id, "error", { error: "Liga nije u konfiguraciji." });
    return false;
  }

  const collected = await collectDay(league, row.date, row.forceFresh);
  if (collected.matches.length === 0) {
    await db().delete(matchAnalyses).where(eq(matchAnalyses.analysisId, row.id));
    await setStatus(row.id, "empty", { matchCount: 0, completedAt: new Date() });
    return false;
  }

  const fixtureIds = collected.matches.map((m) => m.fixtureId);
  // Utakmice koje više nisu na rasporedu (odgođene) se brišu.
  await db()
    .delete(matchAnalyses)
    .where(
      and(
        eq(matchAnalyses.analysisId, row.id),
        sql`${matchAnalyses.fixtureId} NOT IN (${sql.join(fixtureIds.map((id) => sql`${id}`), sql`, `)})`,
      ),
    );
  for (const facts of collected.matches) {
    await db()
      .insert(matchAnalyses)
      .values({
        analysisId: row.id,
        leagueKey: row.leagueKey,
        fixtureId: facts.fixtureId,
        kickoff: new Date(facts.kickoff),
        status: "pending",
        facts,
      })
      .onConflictDoUpdate({
        target: [matchAnalyses.analysisId, matchAnalyses.fixtureId],
        set: { facts, kickoff: new Date(facts.kickoff), status: "pending", error: null, updatedAt: new Date() },
      });
  }
  await setStatus(row.id, "working", { matchCount: collected.matches.length });
  return true;
}

/** Atomarno preuzmi do `limit` utakmica koje čekaju (ili su zapele). */
async function claimMatches(analysisId: number, limit: number) {
  const staleBefore = new Date(Date.now() - STALE_MS);
  const result = await db().execute(sql`
    UPDATE match_analyses SET status = 'working', claimed_at = now(), updated_at = now()
    WHERE id IN (
      SELECT id FROM match_analyses
      WHERE analysis_id = ${analysisId}
        AND (status = 'pending' OR (status = 'working' AND claimed_at < ${staleBefore.toISOString()}::timestamptz))
      ORDER BY kickoff
      LIMIT ${limit}
    )
    RETURNING id`);
  const ids = (result.rows as { id: number }[]).map((r) => r.id);
  if (ids.length === 0) return [];
  return db().select().from(matchAnalyses).where(inArray(matchAnalyses.id, ids));
}

async function processMatch(row: AnalysisRow, match: typeof matchAnalyses.$inferSelect) {
  try {
    const { ai, sources } = await analyseMatch(match.facts, row.date);
    await db()
      .update(matchAnalyses)
      .set({ status: "done", ai, sources, error: null, updatedAt: new Date() })
      .where(eq(matchAnalyses.id, match.id));
  } catch (err) {
    console.error(`[jobs] utakmica ${match.fixtureId} nije analizirana`, err);
    await db()
      .update(matchAnalyses)
      .set({ status: "error", error: err instanceof Error ? err.message : String(err), updatedAt: new Date() })
      .where(eq(matchAnalyses.id, match.id));
  }
  // Otkucaj: posao je živ.
  await db().update(analyses).set({ updatedAt: new Date() }).where(eq(analyses.id, row.id));
}

/**
 * Glavna petlja posla. Radi dok ima vremena u ovoj invokaciji;
 * ako posao nije gotov, pokreće nastavak u novoj invokaciji.
 */
export async function runJob(analysisId: number, origin?: string): Promise<void> {
  const started = Date.now();
  const [row] = await db().select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
  if (!row) return;

  try {
    if (row.status === "queued" || (row.status === "working" && row.matchCount === null)) {
      const ok = await prepare(row);
      if (!ok) return;
    } else if (row.status !== "working") {
      return;
    }

    while (Date.now() - started < INVOCATION_BUDGET_MS - MIN_TIME_FOR_MATCH_MS) {
      const batch = await claimMatches(row.id, CONCURRENCY);
      if (batch.length === 0) break;
      await Promise.all(batch.map((m) => processMatch(row, m)));
    }

    const counts = await db()
      .select({ status: matchAnalyses.status, n: sql<number>`count(*)::int` })
      .from(matchAnalyses)
      .where(eq(matchAnalyses.analysisId, row.id))
      .groupBy(matchAnalyses.status);
    const by = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Record<string, number>;
    const open = (by.pending ?? 0) + (by.working ?? 0);

    if (open > 0) {
      if ((by.pending ?? 0) > 0) await kickProcessing(row.id, origin);
      return;
    }
    if ((by.done ?? 0) > 0) {
      await setStatus(row.id, "done", { completedAt: new Date(), forceFresh: false });
    } else {
      await setStatus(row.id, "error", { error: "Nijedna utakmica nije analizirana." });
    }
  } catch (err) {
    console.error(`[jobs] analiza ${analysisId} nije uspjela`, err);
    await setStatus(analysisId, "error", { error: err instanceof Error ? err.message : String(err) });
  }
}
