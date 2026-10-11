import { describe, expect, it } from "vitest";
import { buildForm, extractMatchWinnerOdds, leagueGoalAverages, pickLeague } from "./mappers";
import type { ApiFixture, ApiLeagueItem, ApiStandingRow } from "./types";

function fx(id: number, ts: number, home: [number, string], away: [number, string], gh: number, ga: number): ApiFixture {
  return {
    fixture: { id, date: new Date(ts * 1000).toISOString(), timestamp: ts, venue: { id: null, name: null, city: null }, status: { short: "FT", long: "" } },
    league: { id: 1, name: "L", season: 2026, round: "R" },
    teams: { home: { id: home[0], name: home[1] }, away: { id: away[0], name: away[1] } },
    goals: { home: gh, away: ga },
    score: { fulltime: { home: gh, away: ga } },
  };
}

describe("pickLeague", () => {
  const items: ApiLeagueItem[] = [
    { league: { id: 79, name: "2. Bundesliga", type: "League" }, country: { name: "Germany" }, seasons: [{ year: 2026, current: true, start: "", end: "" }] },
    { league: { id: 78, name: "Bundesliga", type: "League" }, country: { name: "Germany" }, seasons: [{ year: 2025, current: false, start: "", end: "" }, { year: 2026, current: true, start: "", end: "" }] },
    { league: { id: 218, name: "Bundesliga", type: "League" }, country: { name: "Austria" }, seasons: [{ year: 2026, current: true, start: "", end: "" }] },
  ];

  it("bira ligu po državi i točnom imenu, s aktualnom sezonom", () => {
    expect(pickLeague(items, { country: "Germany", apiNames: ["Bundesliga"], type: "league" })).toEqual({
      id: 78,
      name: "Bundesliga",
      season: 2026,
    });
  });

  it("vraća null kad nema pogotka", () => {
    expect(pickLeague(items, { country: "Spain", apiNames: ["La Liga"], type: "league" })).toBeNull();
  });
});

describe("buildForm", () => {
  const results = [
    fx(1, 100, [10, "Alpha"], [20, "Beta"], 2, 1),
    fx(2, 200, [30, "Gamma"], [10, "Alpha"], 1, 1),
    fx(3, 300, [10, "Alpha"], [40, "Delta"], 0, 3),
    fx(4, 400, [50, "Eps"], [60, "Zeta"], 1, 0),
  ];

  it("vraća formu iz perspektive momčadi, najnovija prva", () => {
    const form = buildForm(results, 10);
    expect(form.map((f) => `${f.result}${f.away ? "@" : ""}${f.opponent} ${f.score}`)).toEqual([
      "IDelta 0:3",
      "N@Gamma 1:1",
      "PBeta 2:1",
    ]);
  });
});

describe("leagueGoalAverages", () => {
  const split = (played: number, gf: number) => ({ played, win: 0, draw: 0, lose: 0, goals: { for: gf, against: 0 } });
  const row = (hp: number, hg: number, ap: number, ag: number): ApiStandingRow => ({
    rank: 1, team: { id: 1, name: "X" }, points: 0, goalsDiff: 0, form: null,
    all: split(hp + ap, hg + ag), home: split(hp, hg), away: split(ap, ag),
  });

  it("računa prosjek golova doma i u gostima", () => {
    expect(leagueGoalAverages([row(4, 8, 4, 4), row(4, 4, 4, 4)])).toEqual({ homeGoalsPerGame: 1.5, awayGoalsPerGame: 1 });
  });

  it("vraća null bez odigranih utakmica", () => {
    expect(leagueGoalAverages([row(0, 0, 0, 0)])).toBeNull();
  });
});

describe("extractMatchWinnerOdds", () => {
  it("preferira Bet365 i čita Home/Draw/Away", () => {
    const odds = extractMatchWinnerOdds({
      fixture: { id: 1 },
      bookmakers: [
        { id: 1, name: "Other", bets: [{ id: 1, name: "Match Winner", values: [{ value: "Home", odd: "2.1" }, { value: "Draw", odd: "3.3" }, { value: "Away", odd: "3.6" }] }] },
        { id: 8, name: "Bet365", bets: [{ id: 1, name: "Match Winner", values: [{ value: "Home", odd: "2.00" }, { value: "Draw", odd: "3.40" }, { value: "Away", odd: "3.75" }] }] },
      ],
    });
    expect(odds).toEqual({ home: 2, draw: 3.4, away: 3.75, bookmaker: "Bet365" });
  });

  it("vraća null bez 1X2 tržišta", () => {
    expect(extractMatchWinnerOdds({ fixture: { id: 1 }, bookmakers: [] })).toBeNull();
    expect(extractMatchWinnerOdds(undefined)).toBeNull();
  });
});
