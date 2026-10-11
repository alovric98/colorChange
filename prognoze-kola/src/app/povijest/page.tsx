import type { Metadata } from "next";
import { getLeague } from "@/config/leagues";
import { formatShortDate } from "@/lib/dates";
import { formatPercent } from "@/lib/format";
import { getHistoryStats, getRecentSettled, type LeagueStats } from "@/lib/queries";
import { EXTRA_MARKET_LABEL } from "@/lib/tips";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Povijest · Prognoze kola" };

const pct = (hits: number, total: number) => (total > 0 ? formatPercent((hits / total) * 100) : "–");

function Mark({ hit }: { hit: boolean | null }) {
  if (hit === null) return <span className="muted">poništeno</span>;
  return hit ? <span className="ok">✓ pogodak</span> : <span className="ko">✗ promašaj</span>;
}

export default async function HistoryPage() {
  let stats: LeagueStats[] = [];
  let recent: Awaited<ReturnType<typeof getRecentSettled>> = [];
  let dbError = false;
  try {
    [stats, recent] = await Promise.all([getHistoryStats(), getRecentSettled()]);
  } catch (err) {
    console.error("[povijest]", err);
    dbError = true;
  }

  const total = stats.reduce(
    (acc, s) => ({
      matches: acc.matches + s.matches,
      mainHits: acc.mainHits + s.mainHits,
      extraHits: acc.extraHits + s.extraHits,
    }),
    { matches: 0, mainHits: 0, extraHits: 0 },
  );

  return (
    <>
      <h1 className="day-title">Povijest</h1>
      <p className="day-sub">Pogoci i promašaji nakon odigranih utakmica (rezultat nakon 90 minuta).</p>

      {dbError && <p className="error-text">Baza podataka nije dostupna.</p>}

      <div className="stats">
        <div className="stat">
          <div className="small">Utakmica s rezultatom</div>
          <div className="big">{total.matches}</div>
        </div>
        <div className="stat">
          <div className="small">Glavni tip (točan rezultat)</div>
          <div className="big">{pct(total.mainHits, total.matches)}</div>
          <div className="small">{total.mainHits} pogodaka</div>
        </div>
        <div className="stat">
          <div className="small">Dodatni tip</div>
          <div className="big">{pct(total.extraHits, total.matches)}</div>
          <div className="small">{total.extraHits} pogodaka</div>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Liga</th>
                <th className="num">Utakmica</th>
                <th className="num">Glavni tip</th>
                <th className="num">Dodatni tip</th>
              </tr>
            </thead>
            <tbody>
              {stats
                .sort((a, b) => b.matches - a.matches)
                .map((s) => (
                  <tr key={s.leagueKey}>
                    <td>{getLeague(s.leagueKey)?.name ?? s.leagueKey}</td>
                    <td className="num">{s.matches}</td>
                    <td className="num">
                      {pct(s.mainHits, s.matches)} ({s.mainHits})
                    </td>
                    <td className="num">
                      {pct(s.extraHits, s.matches)} ({s.extraHits})
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {recent.length === 0 ? (
        !dbError && <p className="empty">Još nema odigranih utakmica s prognozom.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Utakmica</th>
                <th className="num">Rezultat</th>
                <th>Glavni tip</th>
                <th>Dodatni tip</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((m) => (
                <tr key={m.id}>
                  <td>{formatShortDate(m.kickoff.toISOString())}</td>
                  <td>
                    {m.facts.home.short} – {m.facts.away.short}{" "}
                    <span className="muted">{getLeague(m.leagueKey)?.name}</span>
                  </td>
                  <td className="num">
                    {m.homeGoals !== null ? `${m.homeGoals}:${m.awayGoals}` : m.fixtureStatus ?? "–"}
                  </td>
                  <td>
                    {m.ai ? `${m.ai.mainTip.home}:${m.ai.mainTip.away}` : "–"} <Mark hit={m.mainHit} />
                  </td>
                  <td>
                    {m.ai ? EXTRA_MARKET_LABEL[m.ai.extraTip.market] : "–"} <Mark hit={m.extraHit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
