/** Podskup odgovora API-Footballa v3 koji aplikacija koristi. */

export interface ApiLeagueItem {
  league: { id: number; name: string; type: string };
  country: { name: string };
  seasons: { year: number; current: boolean; start: string; end: string }[];
}

export interface ApiTeamRef {
  id: number;
  name: string;
  winner?: boolean | null;
}

export interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    venue: { id: number | null; name: string | null; city: string | null };
    status: { short: string; long: string };
  };
  league: { id: number; name: string; season: number; round: string };
  teams: { home: ApiTeamRef; away: ApiTeamRef };
  goals: { home: number | null; away: number | null };
  score: { fulltime: { home: number | null; away: number | null } };
}

interface ApiSplit {
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals: { for: number; against: number };
}

export interface ApiStandingRow {
  rank: number;
  team: { id: number; name: string };
  points: number;
  goalsDiff: number;
  form: string | null;
  all: ApiSplit;
  home: ApiSplit;
  away: ApiSplit;
}

export interface ApiStandingsItem {
  league: { id: number; season: number; standings: ApiStandingRow[][] };
}

export interface ApiInjury {
  player: { id: number; name: string; type: string; reason: string };
  team: { id: number; name: string };
  fixture: { id: number };
}

export interface ApiOddsItem {
  fixture: { id: number };
  bookmakers: {
    id: number;
    name: string;
    bets: { id: number; name: string; values: { value: string; odd: string }[] }[];
  }[];
}
