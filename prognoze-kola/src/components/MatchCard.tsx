import type { matchAnalyses } from "@/db/schema";
import type { FormEntry, MatchFacts, TeamFacts } from "@/lib/analysis/types";
import { formatKickoff, formatShortDate } from "@/lib/dates";
import { formatPercent, pointsLabel, roundLabel } from "@/lib/format";
import { EXTRA_MARKET_LABEL } from "@/lib/tips";

type MatchRow = typeof matchAnalyses.$inferSelect;

const NA = "Podaci nisu bili dostupni";

function TeamBlock({ team }: { team: TeamFacts }) {
  return (
    <div className="team">
      <div className="badge" style={{ ["--team" as string]: team.color }} aria-hidden>
        {team.short}
      </div>
      <div className="team-name">{team.name}</div>
      <div className="team-meta">
        {team.rank !== null && team.points !== null ? (
          <>
            <span className="nowrap">{team.rank}. mjesto</span> · <span className="nowrap">{pointsLabel(team.points)}</span>
          </>
        ) : (
          "Tablica nije dostupna"
        )}
      </div>
    </div>
  );
}

function ProbBar({ p }: { p: NonNullable<MatchFacts["probability"]> }) {
  const seg = (cls: string, label: string, value: number) => (
    <div className={cls} style={{ flexGrow: value, flexBasis: 0 }} title={`${label}: ${formatPercent(value)}`}>
      {value >= 14 ? `${label} · ${formatPercent(value)}` : label}
    </div>
  );
  return (
    <>
      <div className="probbar" role="img" aria-label={`1 ${formatPercent(p.home)}, X ${formatPercent(p.draw)}, 2 ${formatPercent(p.away)}`}>
        {seg("p1", "1", p.home)}
        {seg("px", "X", p.draw)}
        {seg("p2", "2", p.away)}
      </div>
      <div className="prob-source">
        Izvor: {p.sourceLabel} ({p.detail})
      </div>
    </>
  );
}

function FormBlock({ team }: { team: TeamFacts }) {
  return (
    <div>
      <div className="form-team">{team.name}</div>
      {team.form === null ? (
        <p className="muted">{NA}</p>
      ) : team.form.length === 0 ? (
        <p className="muted">Još nema odigranih utakmica.</p>
      ) : (
        <ul className="form-list">
          {team.form.map((f: FormEntry, i) => (
            <li key={i}>
              <span className={`res ${f.result}`}>{f.result}</span>
              <span>
                {f.away ? "@" : ""}
                {f.opponent}
              </span>
              <span className="score">{f.score}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HitMark({ hit }: { hit: boolean | null }) {
  if (hit === null) return null;
  return (
    <span className={`hit ${hit ? "ok" : "ko"}`} aria-label={hit ? "pogodak" : "promašaj"}>
      {hit ? "✓" : "✗"}
    </span>
  );
}

export function MatchCard({ match, analysisInProgress }: { match: MatchRow; analysisInProgress: boolean }) {
  const f = match.facts;
  const ai = match.ai;
  const homeAbs = f.absences?.filter((a) => a.side === "home") ?? [];
  const awayAbs = f.absences?.filter((a) => a.side === "away") ?? [];
  const pending = match.status === "pending" || match.status === "working" || (analysisInProgress && !ai);

  return (
    <article className="card" aria-label={`${f.home.name} – ${f.away.name}`}>
      <div className="band">
        <span>{roundLabel(f.round) ?? f.league.name}</span>
        <span className="right">{f.league.name}</span>
      </div>

      <div className="matchup">
        <TeamBlock team={f.home} />
        <div className="kick">
          <span className="time">{formatKickoff(f.kickoff)}</span>
          <span className="venue">{f.venue ? `${f.venue}${f.city ? `, ${f.city}` : ""}` : "Stadion nepoznat"}</span>
          {match.homeGoals !== null && match.awayGoals !== null && (
            <span className="final">
              Kraj {match.homeGoals}:{match.awayGoals}
            </span>
          )}
        </div>
        <TeamBlock team={f.away} />
      </div>

      <section className="section verdict">
        <h3 className="label">Presuda</h3>
        {ai ? (
          <p>{ai.verdict}</p>
        ) : pending ? (
          <p className="placeholder">Analiza je u tijeku…</p>
        ) : (
          <p className="placeholder">
            Analiza nije uspjela{match.error ? ` (${match.error.slice(0, 120)})` : ""}. Pokušaj „Osvježi analizu”.
          </p>
        )}
      </section>

      {ai && (
        <section className="section">
          <div className="tips">
            <span className="tip main">
              Tip {ai.mainTip.home}:{ai.mainTip.away}
              <HitMark hit={match.mainHit} />
            </span>
            <span className="tip extra">
              {EXTRA_MARKET_LABEL[ai.extraTip.market]}
              <HitMark hit={match.extraHit} />
            </span>
          </div>
        </section>
      )}

      <section className="section">
        <h3 className="label">Vjerojatnost 1 / X / 2</h3>
        {f.probability ? <ProbBar p={f.probability} /> : <p className="muted">{NA}</p>}
      </section>

      {ai && (
        <section className="section">
          <h3 className="label">Zašto</h3>
          <ul className="reasons">
            {ai.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h3 className="label">Forma – zadnjih 5</h3>
        <div className="form-grid">
          <FormBlock team={f.home} />
          <FormBlock team={f.away} />
        </div>
      </section>

      <section className="section">
        <h3 className="label">Međusobni susreti</h3>
        {f.h2h === null ? (
          <p className="muted">{NA}</p>
        ) : f.h2h.length === 0 ? (
          <p className="muted">Nema prethodnih susreta.</p>
        ) : (
          <ul className="plain">
            {f.h2h.map((h, i) => (
              <li key={i}>
                <span className="muted">{formatShortDate(h.date)}</span> {h.home} – {h.away} <strong>{h.score}</strong>{" "}
                <span className="muted">({h.competition})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <h3 className="label">Izostanci</h3>
        {f.absences === null ? (
          <p className="muted">{NA}</p>
        ) : f.absences.length === 0 ? (
          <p className="muted">Nema prijavljenih izostanaka.</p>
        ) : (
          <div className="form-grid">
            {[
              { team: f.home, list: homeAbs },
              { team: f.away, list: awayAbs },
            ].map(({ team, list }) => (
              <div key={team.id}>
                <div className="form-team">{team.name}</div>
                {list.length === 0 ? (
                  <p className="muted">Nema prijavljenih.</p>
                ) : (
                  <ul className="plain">
                    {list.map((a, i) => (
                      <li key={i}>
                        {a.player} <span className="muted">– {a.reason}{a.type === "Questionable" ? " (upitan)" : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {ai && ai.note && (
        <section className="section">
          <h3 className="label">Napomena</h3>
          <p style={{ margin: 0 }}>{ai.note}</p>
        </section>
      )}

      <footer className="section sources">
        <h3 className="label">Izvori</h3>
        <ul>
          <li>API-Football (tablica, forma, međusobni susreti, izostanci, koeficijenti)</li>
          {(match.sources ?? []).map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                {s.title}
              </a>
            </li>
          ))}
          {f.missing.length > 0 && <li>Nedostaje: {f.missing.join(", ")}</li>}
        </ul>
      </footer>
    </article>
  );
}
