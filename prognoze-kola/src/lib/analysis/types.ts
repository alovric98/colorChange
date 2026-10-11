import { z } from "zod";
import { EXTRA_MARKETS } from "@/lib/tips";
import type { ProbabilitySource } from "@/lib/probability";

/** Rezultat iz perspektive momčadi: P = pobjeda, N = neriješeno, I = izgubljeno. */
export type FormResult = "P" | "N" | "I";

export interface FormEntry {
  result: FormResult;
  opponent: string;
  opponentShort: string;
  /** true = gostovanje (u sučelju "@") */
  away: boolean;
  /** Golovi iz perspektive momčadi, npr. "2:1" */
  score: string;
  date: string;
}

export interface TeamFacts {
  id: number;
  name: string;
  short: string;
  color: string;
  rank: number | null;
  points: number | null;
  played: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  /** Domaćin: učinak doma; gost: učinak u gostima. */
  venueRecord: { played: number; win: number; draw: number; lose: number; scored: number; conceded: number } | null;
  /** null = podaci nisu bili dostupni */
  form: FormEntry[] | null;
}

export interface H2HEntry {
  date: string;
  competition: string;
  home: string;
  away: string;
  score: string;
}

export interface Absence {
  side: "home" | "away";
  player: string;
  /** "Missing Fixture" / "Questionable" iz API-Footballa */
  type: string;
  reason: string;
}

export interface ProbabilityFacts {
  home: number;
  draw: number;
  away: number;
  source: ProbabilitySource;
  sourceLabel: string;
  /** npr. "Bet365, marža 5,1 %" ili "λ 1,62 – 1,05" */
  detail: string;
}

export interface MatchFacts {
  fixtureId: number;
  kickoff: string;
  round: string | null;
  venue: string | null;
  city: string | null;
  home: TeamFacts;
  away: TeamFacts;
  h2h: H2HEntry[] | null;
  absences: Absence[] | null;
  odds: { home: number; draw: number; away: number; bookmaker: string } | null;
  probability: ProbabilityFacts | null;
  poisson: {
    lambdaHome: number;
    lambdaAway: number;
    btts: number;
    over25: number;
    topScores: { home: number; away: number; probability: number }[];
  } | null;
  league: { name: string; season: number; homeGoalsPerGame: number | null; awayGoalsPerGame: number | null };
  /** Popis podataka koje API-Football nije vratio. */
  missing: string[];
}

export interface SourceLink {
  title: string;
  url: string;
}

/** Shema odgovora koji Claude mora vratiti (strogi JSON). */
export const AiMatchSchema = z
  .object({
    verdict: z.string().min(15).max(320),
    mainTip: z
      .object({
        home: z.number().int().min(0).max(9),
        away: z.number().int().min(0).max(9),
      })
      .strict(),
    extraTip: z.object({ market: z.enum(EXTRA_MARKETS) }).strict(),
    reasons: z.array(z.string().min(8).max(240)).min(3).max(5),
    note: z.string().max(450),
    sources: z
      .array(z.object({ title: z.string().min(1).max(200), url: z.url() }).strict())
      .max(8),
  })
  .strict();

export type AiMatchAnalysis = z.infer<typeof AiMatchSchema>;
