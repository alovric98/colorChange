import "server-only";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { getFixturesByIds } from "@/lib/apifootball/football";
import { FINISHED_STATUSES, isExtraTipHit, isMainTipHit, VOID_STATUSES } from "@/lib/tips";

const { matchAnalyses } = schema;

/** Upisuje stvarne rezultate za utakmice koje su završile, i pogodak/promašaj tipova. */
export async function settleFinishedMatches(): Promise<{ checked: number; settled: number }> {
  const now = Date.now();
  const rows = await db()
    .select({ id: matchAnalyses.id, fixtureId: matchAnalyses.fixtureId, ai: matchAnalyses.ai })
    .from(matchAnalyses)
    .where(
      and(
        isNull(matchAnalyses.settledAt),
        lt(matchAnalyses.kickoff, new Date(now - 135 * 60_000)),
        gt(matchAnalyses.kickoff, new Date(now - 21 * 24 * 3600_000)),
      ),
    );

  const byFixture = new Map<number, typeof rows>();
  for (const r of rows) byFixture.set(r.fixtureId, [...(byFixture.get(r.fixtureId) ?? []), r]);
  const ids = [...byFixture.keys()];

  let settled = 0;
  for (let i = 0; i < ids.length; i += 20) {
    const fixtures = await getFixturesByIds(ids.slice(i, i + 20));
    for (const f of fixtures) {
      const status = f.fixture.status.short;
      const targets = byFixture.get(f.fixture.id) ?? [];
      if (FINISHED_STATUSES.has(status)) {
        // Tipovi se odnose na regularnih 90 minuta.
        const home = f.score.fulltime.home ?? f.goals.home;
        const away = f.score.fulltime.away ?? f.goals.away;
        if (home === null || away === null) continue;
        for (const t of targets) {
          await db()
            .update(matchAnalyses)
            .set({
              fixtureStatus: status,
              homeGoals: home,
              awayGoals: away,
              mainHit: t.ai ? isMainTipHit(t.ai.mainTip, { home, away }) : null,
              extraHit: t.ai ? isExtraTipHit(t.ai.extraTip.market, { home, away }) : null,
              settledAt: new Date(),
            })
            .where(eq(matchAnalyses.id, t.id));
          settled++;
        }
      } else if (VOID_STATUSES.has(status)) {
        for (const t of targets) {
          await db()
            .update(matchAnalyses)
            .set({ fixtureStatus: status, mainHit: null, extraHit: null, settledAt: new Date() })
            .where(eq(matchAnalyses.id, t.id));
          settled++;
        }
      }
    }
  }
  return { checked: ids.length, settled };
}
