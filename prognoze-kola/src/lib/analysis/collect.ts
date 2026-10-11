import "server-only";
import type { LeagueConfig } from "@/config/leagues";
import {
  getFixturesForDay,
  getHeadToHead,
  getInjuries,
  getOddsForDay,
  getSeasonResults,
  getStandings,
  resolveLeague,
} from "@/lib/apifootball/football";
import {
  buildForm,
  buildH2H,
  extractMatchWinnerOdds,
  flattenStandings,
  leagueGoalAverages,
} from "@/lib/apifootball/mappers";
import type { ApiFixture, ApiStandingRow } from "@/lib/apifootball/types";
import { formatPercent, teamColor, teamShort } from "@/lib/format";
import {
  bookmakerMargin,
  poissonProbabilities,
  probabilitiesFromOdds,
  PROBABILITY_SOURCE_LABEL,
  type PoissonResult,
} from "@/lib/probability";
import type { Absence, MatchFacts, TeamFacts } from "./types";

/** Utakmice koje se ne analiziraju (već odigrane / otkazane). */
const SKIP_STATUSES = new Set(["CANC", "ABD", "AWD", "WO"]);

async function safe<T>(label: string, missing: string[], fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[collect] ${label} nije dostupno:`, err);
    missing.push(label);
    return null;
  }
}

function teamFacts(
  team: { id: number; name: string },
  rows: ApiStandingRow[] | null,
  results: ApiFixture[] | null,
  side: "home" | "away",
): TeamFacts {
  const row = rows?.find((r) => r.team.id === team.id);
  const split = row ? (side === "home" ? row.home : row.away) : null;
  return {
    id: team.id,
    name: team.name,
    short: teamShort(team.name),
    color: teamColor(team.name),
    rank: row?.rank ?? null,
    points: row?.points ?? null,
    played: row?.all.played ?? null,
    goalsFor: row?.all.goals.for ?? null,
    goalsAgainst: row?.all.goals.against ?? null,
    venueRecord: split
      ? {
          played: split.played,
          win: split.win,
          draw: split.draw,
          lose: split.lose,
          scored: split.goals.for,
          conceded: split.goals.against,
        }
      : null,
    form: results ? buildForm(results, team.id) : null,
  };
}

export interface CollectedDay {
  leagueName: string;
  season: number;
  matches: MatchFacts[];
}

/** Skuplja sve strukturirane podatke za ligu i dan te računa vjerojatnosti. */
export async function collectDay(cfg: LeagueConfig, date: string, fresh: boolean): Promise<CollectedDay> {
  const league = await resolveLeague(cfg);
  const fixtures = (await getFixturesForDay(league.id, league.season, date, fresh)).filter(
    (f) => !SKIP_STATUSES.has(f.fixture.status.short),
  );
  if (fixtures.length === 0) return { leagueName: league.name, season: league.season, matches: [] };

  const dayMissing: string[] = [];
  const [standings, results, oddsItems] = await Promise.all([
    safe("tablica", dayMissing, () => getStandings(league.id, league.season)),
    safe("forma", dayMissing, () => getSeasonResults(league.id, league.season)),
    safe("koeficijenti", dayMissing, () => getOddsForDay(league.id, league.season, date, fresh)),
  ]);
  const rows = standings ? flattenStandings(standings) : null;
  const averages = rows ? leagueGoalAverages(rows) : null;

  const matches: MatchFacts[] = [];
  for (const f of fixtures) {
    const missing = [...dayMissing];
    const [h2hRaw, injuriesRaw] = await Promise.all([
      safe("međusobni susreti", missing, () => getHeadToHead(f.teams.home.id, f.teams.away.id)),
      safe("izostanci", missing, () => getInjuries(f.fixture.id, fresh)),
    ]);

    const home = teamFacts(f.teams.home, rows, results, "home");
    const away = teamFacts(f.teams.away, rows, results, "away");
    if (rows && home.rank === null) missing.push("tablica (domaćin)");
    if (rows && away.rank === null) missing.push("tablica (gost)");

    const absences: Absence[] | null = injuriesRaw
      ? injuriesRaw
          .filter((i) => i.team.id === home.id || i.team.id === away.id)
          .map((i) => ({
            side: i.team.id === home.id ? "home" : "away",
            player: i.player.name,
            type: i.player.type,
            reason: i.player.reason,
          }))
      : null;

    const odds = oddsItems ? extractMatchWinnerOdds(oddsItems.find((o) => o.fixture.id === f.fixture.id)) : null;
    if (oddsItems && !odds) missing.push("koeficijenti za utakmicu");

    let poisson: PoissonResult | null = null;
    if (averages && home.venueRecord?.played && away.venueRecord?.played) {
      poisson = poissonProbabilities(
        { played: home.venueRecord.played, scored: home.venueRecord.scored, conceded: home.venueRecord.conceded },
        { played: away.venueRecord.played, scored: away.venueRecord.scored, conceded: away.venueRecord.conceded },
        averages,
      );
    }

    let probability: MatchFacts["probability"] = null;
    if (odds) {
      probability = {
        ...probabilitiesFromOdds(odds),
        source: "odds",
        sourceLabel: PROBABILITY_SOURCE_LABEL.odds,
        detail: `${odds.bookmaker}: ${odds.home} / ${odds.draw} / ${odds.away}, marža ${formatPercent(bookmakerMargin(odds))}`,
      };
    } else if (poisson) {
      probability = {
        home: poisson.home,
        draw: poisson.draw,
        away: poisson.away,
        source: "poisson",
        sourceLabel: PROBABILITY_SOURCE_LABEL.poisson,
        detail: `očekivani golovi ${poisson.lambdaHome.toFixed(2).replace(".", ",")} – ${poisson.lambdaAway
          .toFixed(2)
          .replace(".", ",")}`,
      };
    } else {
      missing.push("vjerojatnost ishoda");
    }

    matches.push({
      fixtureId: f.fixture.id,
      kickoff: f.fixture.date,
      round: f.league.round ?? null,
      venue: f.fixture.venue?.name ?? null,
      city: f.fixture.venue?.city ?? null,
      home,
      away,
      h2h: h2hRaw ? buildH2H(h2hRaw) : null,
      absences,
      odds,
      probability,
      poisson: poisson
        ? {
            lambdaHome: poisson.lambdaHome,
            lambdaAway: poisson.lambdaAway,
            btts: poisson.btts,
            over25: poisson.over25,
            topScores: poisson.topScores,
          }
        : null,
      league: {
        name: league.name,
        season: league.season,
        homeGoalsPerGame: averages ? Math.round(averages.homeGoalsPerGame * 100) / 100 : null,
        awayGoalsPerGame: averages ? Math.round(averages.awayGoalsPerGame * 100) / 100 : null,
      },
      missing: [...new Set(missing)],
    });
  }
  return { leagueName: league.name, season: league.season, matches };
}
