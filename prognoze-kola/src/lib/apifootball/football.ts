import "server-only";
import type { LeagueConfig } from "@/config/leagues";
import { TIME_ZONE } from "@/lib/dates";
import { apiGet, ApiFootballError, TTL } from "./client";
import { pickLeague } from "./mappers";
import type { ApiFixture, ApiInjury, ApiLeagueItem, ApiOddsItem, ApiStandingsItem } from "./types";

/** Pronalazi ID lige i aktualnu sezonu preko /leagues (ne pretpostavlja ID). */
export async function resolveLeague(cfg: LeagueConfig): Promise<{ id: number; name: string; season: number }> {
  const params: Record<string, string | number> = cfg.apiFootballId
    ? { id: cfg.apiFootballId }
    : { country: cfg.country, type: cfg.type };
  const items = await apiGet<ApiLeagueItem>("/leagues", params, TTL.leagues);
  const picked = pickLeague(items, cfg);
  if (!picked) {
    throw new ApiFootballError(
      `Liga "${cfg.name}" nije pronađena u /leagues (${cfg.country}, ${cfg.apiNames.join(" / ")}). Pokreni npm run leagues:check.`,
    );
  }
  return picked;
}

export function getFixturesForDay(leagueId: number, season: number, date: string, fresh = false) {
  return apiGet<ApiFixture>(
    "/fixtures",
    { league: leagueId, season, date, timezone: TIME_ZONE },
    TTL.fixturesDay,
    { fresh },
  );
}

export async function getStandings(leagueId: number, season: number) {
  const items = await apiGet<ApiStandingsItem>("/standings", { league: leagueId, season }, TTL.standings);
  return items[0]?.league.standings;
}

/** Sve završene utakmice sezone u natjecanju – jedan poziv pokriva formu svih momčadi. */
export function getSeasonResults(leagueId: number, season: number) {
  return apiGet<ApiFixture>("/fixtures", { league: leagueId, season, status: "FT-AET-PEN" }, TTL.seasonResults);
}

export function getHeadToHead(homeId: number, awayId: number) {
  const [a, b] = [homeId, awayId].sort((x, y) => x - y);
  return apiGet<ApiFixture>("/fixtures/headtohead", { h2h: `${a}-${b}`, last: 5 }, TTL.h2h);
}

export function getInjuries(fixtureId: number, fresh = false) {
  return apiGet<ApiInjury>("/injuries", { fixture: fixtureId }, TTL.injuries, { fresh });
}

/** Koeficijenti za sve utakmice lige na dan (paginirano). */
export function getOddsForDay(leagueId: number, season: number, date: string, fresh = false) {
  return apiGet<ApiOddsItem>(
    "/odds",
    { league: leagueId, season, date, bet: 1, timezone: TIME_ZONE },
    TTL.odds,
    { fresh, maxPages: 4 },
  );
}

/** Do 20 utakmica po pozivu – za upis rezultata. */
export function getFixturesByIds(ids: number[]) {
  if (ids.length === 0 || ids.length > 20) throw new Error("getFixturesByIds: 1–20 ID-eva");
  return apiGet<ApiFixture>("/fixtures", { ids: ids.join("-") }, TTL.results, { fresh: true });
}
