/** Čiste funkcije za pretvaranje odgovora API-Footballa u podatke kartice. */
import type { LeagueConfig } from "@/config/leagues";
import { teamShort } from "@/lib/format";
import type { FormEntry, H2HEntry } from "@/lib/analysis/types";
import type { ApiFixture, ApiLeagueItem, ApiOddsItem, ApiStandingRow } from "./types";

const norm = (s: string) => s.trim().toLowerCase();

/** Bira ligu iz /leagues odgovora prema državi, tipu i mogućim nazivima. */
export function pickLeague(
  items: ApiLeagueItem[],
  cfg: Pick<LeagueConfig, "country" | "apiNames" | "type" | "apiFootballId">,
): { id: number; name: string; season: number } | null {
  const candidates = items.filter(
    (i) => norm(i.country.name) === norm(cfg.country) && norm(i.league.type) === cfg.type,
  );
  let match: ApiLeagueItem | undefined;
  if (cfg.apiFootballId) {
    match = items.find((i) => i.league.id === cfg.apiFootballId);
  } else {
    for (const name of cfg.apiNames) {
      match = candidates.find((i) => norm(i.league.name) === norm(name));
      if (match) break;
    }
  }
  if (!match) return null;
  const season =
    match.seasons.find((s) => s.current) ?? [...match.seasons].sort((a, b) => b.year - a.year)[0];
  if (!season) return null;
  return { id: match.league.id, name: match.league.name, season: season.year };
}

/** Zadnjih `n` odigranih utakmica momčadi iz liste završenih utakmica, najnovija prva. */
export function buildForm(results: ApiFixture[], teamId: number, n = 5): FormEntry[] {
  return results
    .filter(
      (f) =>
        (f.teams.home.id === teamId || f.teams.away.id === teamId) &&
        f.goals.home !== null &&
        f.goals.away !== null,
    )
    .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
    .slice(0, n)
    .map((f) => {
      const isHome = f.teams.home.id === teamId;
      const own = (isHome ? f.goals.home : f.goals.away) as number;
      const opp = (isHome ? f.goals.away : f.goals.home) as number;
      const opponent = isHome ? f.teams.away.name : f.teams.home.name;
      return {
        result: own > opp ? "P" : own === opp ? "N" : "I",
        opponent,
        opponentShort: teamShort(opponent),
        away: !isHome,
        score: `${own}:${opp}`,
        date: f.fixture.date,
      } satisfies FormEntry;
    });
}

export function buildH2H(fixtures: ApiFixture[], n = 5): H2HEntry[] {
  return fixtures
    .filter((f) => f.goals.home !== null && f.goals.away !== null)
    .sort((a, b) => b.fixture.timestamp - a.fixture.timestamp)
    .slice(0, n)
    .map((f) => ({
      date: f.fixture.date,
      competition: f.league.name,
      home: f.teams.home.name,
      away: f.teams.away.name,
      score: `${f.goals.home}:${f.goals.away}`,
    }));
}

/** Svi redovi tablice (kod Lige prvaka i grupa spaja sve skupine). */
export function flattenStandings(groups: ApiStandingRow[][] | undefined): ApiStandingRow[] {
  return (groups ?? []).flat();
}

/** Prosjek golova domaćina i gosta po utakmici u ligi, iz tablice. */
export function leagueGoalAverages(
  rows: ApiStandingRow[],
): { homeGoalsPerGame: number; awayGoalsPerGame: number } | null {
  let homeGames = 0;
  let homeGoals = 0;
  let awayGames = 0;
  let awayGoals = 0;
  for (const r of rows) {
    homeGames += r.home.played;
    homeGoals += r.home.goals.for;
    awayGames += r.away.played;
    awayGoals += r.away.goals.for;
  }
  if (homeGames === 0 || awayGames === 0 || homeGoals === 0 || awayGoals === 0) return null;
  return {
    homeGoalsPerGame: homeGoals / homeGames,
    awayGoalsPerGame: awayGoals / awayGames,
  };
}

const PREFERRED_BOOKMAKERS = ["Bet365", "Pinnacle", "Unibet", "1xBet", "Bwin"];

/** Koeficijenti 1X2 ("Match Winner", bet id 1) – preferira poznate kladionice. */
export function extractMatchWinnerOdds(
  item: ApiOddsItem | undefined,
): { home: number; draw: number; away: number; bookmaker: string } | null {
  if (!item) return null;
  const sorted = [...item.bookmakers].sort((a, b) => {
    const ia = PREFERRED_BOOKMAKERS.indexOf(a.name);
    const ib = PREFERRED_BOOKMAKERS.indexOf(b.name);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  for (const bm of sorted) {
    const bet = bm.bets.find((b) => b.id === 1);
    if (!bet) continue;
    const get = (v: string) => Number(bet.values.find((x) => x.value === v)?.odd);
    const odds = { home: get("Home"), draw: get("Draw"), away: get("Away") };
    if ([odds.home, odds.draw, odds.away].every((o) => Number.isFinite(o) && o > 1)) {
      return { ...odds, bookmaker: bm.name };
    }
  }
  return null;
}
