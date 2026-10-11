import "server-only";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { analyses, matchAnalyses } = schema;

export async function getAnalysis(leagueKey: string, date: string) {
  const [row] = await db()
    .select()
    .from(analyses)
    .where(and(eq(analyses.leagueKey, leagueKey), eq(analyses.date, date)))
    .limit(1);
  return row ?? null;
}

export async function getMatches(analysisId: number) {
  return db()
    .select()
    .from(matchAnalyses)
    .where(eq(matchAnalyses.analysisId, analysisId))
    .orderBy(asc(matchAnalyses.kickoff), asc(matchAnalyses.fixtureId));
}

export async function getProgress(analysisId: number) {
  const rows = await db()
    .select({ status: matchAnalyses.status, n: sql<number>`count(*)::int` })
    .from(matchAnalyses)
    .where(eq(matchAnalyses.analysisId, analysisId))
    .groupBy(matchAnalyses.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
  return { done: (by.done ?? 0) + (by.error ?? 0), total: rows.reduce((a, r) => a + r.n, 0) };
}

export interface LeagueStats {
  leagueKey: string;
  matches: number;
  mainHits: number;
  extraHits: number;
}

/** Uspješnost po ligi (samo utakmice s rezultatom i AI tipom). */
export async function getHistoryStats(): Promise<LeagueStats[]> {
  return db()
    .select({
      leagueKey: matchAnalyses.leagueKey,
      matches: sql<number>`count(*)::int`,
      mainHits: sql<number>`count(*) filter (where ${matchAnalyses.mainHit})::int`,
      extraHits: sql<number>`count(*) filter (where ${matchAnalyses.extraHit})::int`,
    })
    .from(matchAnalyses)
    .where(and(isNotNull(matchAnalyses.settledAt), isNotNull(matchAnalyses.mainHit)))
    .groupBy(matchAnalyses.leagueKey);
}

export async function getRecentSettled(limit = 60) {
  return db()
    .select()
    .from(matchAnalyses)
    .where(and(isNotNull(matchAnalyses.settledAt), isNotNull(matchAnalyses.ai)))
    .orderBy(desc(matchAnalyses.kickoff))
    .limit(limit);
}
