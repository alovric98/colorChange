/**
 * Vjerojatnosti ishoda 1 / X / 2.
 * Čiste funkcije bez I/O – testirane u probability.test.ts.
 */

export interface OutcomeProbabilities {
  /** Postoci s jednom decimalom; zbroj je točno 100. */
  home: number;
  draw: number;
  away: number;
}

export type ProbabilitySource = "odds" | "poisson";

export const PROBABILITY_SOURCE_LABEL: Record<ProbabilitySource, string> = {
  odds: "iz koeficijenata kladionica",
  poisson: "Poissonov model iz golova",
};

/**
 * Zaokružuje udjele na jednu decimalu tako da zbroj bude točno 100,0
 * (metoda najvećeg ostatka nad desetinkama postotka).
 */
export function roundToHundred(shares: number[]): number[] {
  const total = shares.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new Error("Zbroj udjela mora biti pozitivan");
  const tenths = shares.map((s) => (s / total) * 1000);
  const floored = tenths.map(Math.floor);
  let remaining = 1000 - floored.reduce((a, b) => a + b, 0);
  const order = tenths
    .map((t, i) => ({ i, rest: t - Math.floor(t) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floored[i] += 1;
    remaining -= 1;
  }
  return floored.map((t) => t / 10);
}

/**
 * Korak 1: decimalni koeficijenti 1X2 → p = 1/koeficijent,
 * normalizirano na 100 % (uklanja se marža kladionice).
 */
export function probabilitiesFromOdds(odds: { home: number; draw: number; away: number }): OutcomeProbabilities {
  const values = [odds.home, odds.draw, odds.away];
  for (const o of values) {
    if (!Number.isFinite(o) || o <= 1) {
      throw new Error(`Neispravan koeficijent: ${o}`);
    }
  }
  const [home, draw, away] = roundToHundred(values.map((o) => 1 / o));
  return { home, draw, away };
}

/** Marža kladionice u postocima (npr. 5,2 znači da implicirane vjerojatnosti daju 105,2 %). */
export function bookmakerMargin(odds: { home: number; draw: number; away: number }): number {
  const overround = 1 / odds.home + 1 / odds.draw + 1 / odds.away;
  return Math.round((overround - 1) * 1000) / 10;
}

export interface GoalStats {
  /** Broj odigranih utakmica (domaćin: doma, gost: u gostima). */
  played: number;
  scored: number;
  conceded: number;
}

export interface LeagueGoalAverages {
  /** Prosjek golova domaćina po utakmici u ligi. */
  homeGoalsPerGame: number;
  /** Prosjek golova gosta po utakmici u ligi. */
  awayGoalsPerGame: number;
}

export interface PoissonResult extends OutcomeProbabilities {
  lambdaHome: number;
  lambdaAway: number;
  /** Vjerojatnost (%) da oba tima zabiju. */
  btts: number;
  /** Vjerojatnost (%) za 3+ gola. */
  over25: number;
  /** Tri najvjerojatnija točna rezultata. */
  topScores: { home: number; away: number; probability: number }[];
}

export const MAX_GOALS = 10;

function poissonPmf(k: number, lambda: number): number {
  let factorial = 1;
  for (let i = 2; i <= k; i++) factorial *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Korak 2: Poissonov model.
 * Snaga napada/obrane računa se relativno prema prosjeku lige:
 *   λ_dom  = (napad domaćina doma)  × (obrana gosta u gostima) × prosjek golova domaćina u ligi
 *   λ_gost = (napad gosta u gostima) × (obrana domaćina doma)  × prosjek golova gosta u ligi
 * Rezultati 0–10 za oba tima; matrica se renormalizira na 100 %.
 */
export function poissonProbabilities(
  home: GoalStats,
  away: GoalStats,
  league: LeagueGoalAverages,
): PoissonResult {
  if (home.played <= 0 || away.played <= 0) {
    throw new Error("Nema odigranih utakmica za Poissonov model");
  }
  if (!(league.homeGoalsPerGame > 0) || !(league.awayGoalsPerGame > 0)) {
    throw new Error("Prosjek golova lige mora biti pozitivan");
  }

  const homeAttack = home.scored / home.played / league.homeGoalsPerGame;
  const homeDefence = home.conceded / home.played / league.awayGoalsPerGame;
  const awayAttack = away.scored / away.played / league.awayGoalsPerGame;
  const awayDefence = away.conceded / away.played / league.homeGoalsPerGame;

  // Mali donji prag da momčad bez ijednog gola ne dobije λ = 0.
  const lambdaHome = Math.max(homeAttack * awayDefence * league.homeGoalsPerGame, 0.05);
  const lambdaAway = Math.max(awayAttack * homeDefence * league.awayGoalsPerGame, 0.05);

  const ph = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poissonPmf(k, lambdaHome));
  const pa = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poissonPmf(k, lambdaAway));

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let pBtts = 0;
  let pOver = 0;
  let total = 0;
  const scores: { home: number; away: number; p: number }[] = [];

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const p = ph[h] * pa[a];
      total += p;
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
      if (h > 0 && a > 0) pBtts += p;
      if (h + a >= 3) pOver += p;
      scores.push({ home: h, away: a, p });
    }
  }

  const [homePct, drawPct, awayPct] = roundToHundred([pHome, pDraw, pAway]);
  const topScores = scores
    .sort((x, y) => y.p - x.p)
    .slice(0, 3)
    .map((s) => ({ home: s.home, away: s.away, probability: round1((s.p / total) * 100) }));

  return {
    home: homePct,
    draw: drawPct,
    away: awayPct,
    lambdaHome: round2(lambdaHome),
    lambdaAway: round2(lambdaAway),
    btts: round1((pBtts / total) * 100),
    over25: round1((pOver / total) * 100),
    topScores,
  };
}
