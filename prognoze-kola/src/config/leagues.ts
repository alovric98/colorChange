/**
 * Popis liga. Novu ligu dodaješ ovdje – ništa drugo ne treba mijenjati.
 *
 * API-Football ID se NE pretpostavlja: aplikacija ga pronalazi preko
 * /leagues (država + tip + ime) i kešira ga. Nakon `npm run leagues:check`
 * možeš potvrđeni ID upisati u `apiFootballId` kako bi se preskočila pretraga.
 */
export interface LeagueConfig {
  /** Kratki ključ za URL i bazu (ne mijenjaj nakon što postoje analize). */
  key: string;
  /** Naziv u sučelju. */
  name: string;
  /** Država kako je zove API-Football ("World" za europska natjecanja). */
  country: string;
  /** Mogući nazivi lige u API-Footballu; prvi pogodak pobjeđuje. */
  apiNames: string[];
  type: "league" | "cup";
  /** Opcionalno: ID potvrđen preko /leagues. */
  apiFootballId?: number;
}

export const LEAGUES: LeagueConfig[] = [
  { key: "premier-liga", name: "Premier liga", country: "England", apiNames: ["Premier League"], type: "league" },
  {
    key: "hnl",
    name: "SuperSport HNL",
    country: "Croatia",
    apiNames: ["HNL", "1. HNL", "SuperSport HNL", "Prva HNL"],
    type: "league",
  },
  { key: "bundesliga", name: "Bundesliga", country: "Germany", apiNames: ["Bundesliga"], type: "league" },
  { key: "la-liga", name: "La Liga", country: "Spain", apiNames: ["La Liga", "LaLiga"], type: "league" },
  { key: "serie-a", name: "Serie A", country: "Italy", apiNames: ["Serie A"], type: "league" },
  { key: "ligue-1", name: "Ligue 1", country: "France", apiNames: ["Ligue 1"], type: "league" },
  {
    key: "liga-prvaka",
    name: "Liga prvaka",
    country: "World",
    apiNames: ["UEFA Champions League"],
    type: "cup",
  },
];

export function getLeague(key: string | undefined | null): LeagueConfig | undefined {
  return LEAGUES.find((l) => l.key === key);
}
