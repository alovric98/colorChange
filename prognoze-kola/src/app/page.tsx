import Link from "next/link";
import { LEAGUES, getLeague } from "@/config/leagues";
import { AnalysisControls } from "@/components/AnalysisControls";
import { MatchCard } from "@/components/MatchCard";
import { dayLabel, formatDateLong, formatDateTime, isSelectableDay, selectableDays, zagrebDate } from "@/lib/dates";
import { getAnalysis, getMatches, getProgress } from "@/lib/queries";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ liga?: string; dan?: string }>;

async function load(leagueKey: string, date: string) {
  try {
    const analysis = await getAnalysis(leagueKey, date);
    if (!analysis) return { analysis: null, matches: [], progress: { done: 0, total: 0 }, dbError: false };
    const [matches, progress] = await Promise.all([getMatches(analysis.id), getProgress(analysis.id)]);
    return { analysis, matches, progress, dbError: false };
  } catch (err) {
    console.error("[page] baza nije dostupna", err);
    return { analysis: null, matches: [], progress: { done: 0, total: 0 }, dbError: true };
  }
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const today = zagrebDate();
  const league = getLeague(params.liga) ?? LEAGUES[0];
  const date = isSelectableDay(params.dan, today) ? params.dan : today;
  const { analysis, matches, progress, dbError } = await load(league.key, date);
  const inProgress = analysis?.status === "queued" || analysis?.status === "working";

  return (
    <>
      <div className="pickers">
        <nav className="chips" aria-label="Liga">
          {LEAGUES.map((l) => (
            <Link
              key={l.key}
              href={`/?liga=${l.key}&dan=${date}`}
              className="chip league"
              aria-current={l.key === league.key ? "true" : undefined}
            >
              {l.name}
            </Link>
          ))}
        </nav>
        <nav className="chips" aria-label="Dan">
          {selectableDays(today).map((d) => (
            <Link
              key={d}
              href={`/?liga=${league.key}&dan=${d}`}
              className="chip"
              aria-current={d === date ? "true" : undefined}
            >
              {dayLabel(d, today)}
            </Link>
          ))}
        </nav>
      </div>

      <h1 className="day-title">{league.name}</h1>
      <p className="day-sub">{formatDateLong(date)}</p>

      {dbError ? (
        <div className="controls">
          <span className="error-text">Baza podataka nije dostupna. Provjeri DATABASE_URL i migracije.</span>
        </div>
      ) : (
        <AnalysisControls
          league={league.key}
          date={date}
          status={analysis?.status ?? "none"}
          done={progress.done}
          total={analysis?.matchCount ?? null}
          updatedAtLabel={analysis ? formatDateTime(analysis.completedAt ?? analysis.updatedAt) : null}
          error={analysis?.error ?? null}
        />
      )}

      {analysis?.status === "empty" && <p className="empty">Nema utakmica ove lige za odabrani dan.</p>}

      {matches.length > 0 && (
        <div className="cards">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} analysisInProgress={inProgress} />
          ))}
        </div>
      )}
    </>
  );
}
