/** Dodatni tipovi i provjera pogotka nakon utakmice. */

export const EXTRA_MARKETS = ["1X", "X2", "12", "BTTS_YES", "BTTS_NO", "OVER_2_5", "UNDER_2_5"] as const;
export type ExtraMarket = (typeof EXTRA_MARKETS)[number];

export const EXTRA_MARKET_LABEL: Record<ExtraMarket, string> = {
  "1X": "1X",
  X2: "X2",
  "12": "12",
  BTTS_YES: "Oba daju gol",
  BTTS_NO: "Oba ne daju gol",
  OVER_2_5: "Više 2,5",
  UNDER_2_5: "Manje 2,5",
};

export interface Score {
  home: number;
  away: number;
}

export function isMainTipHit(tip: Score, result: Score): boolean {
  return tip.home === result.home && tip.away === result.away;
}

export function isExtraTipHit(market: ExtraMarket, r: Score): boolean {
  switch (market) {
    case "1X":
      return r.home >= r.away;
    case "X2":
      return r.away >= r.home;
    case "12":
      return r.home !== r.away;
    case "BTTS_YES":
      return r.home > 0 && r.away > 0;
    case "BTTS_NO":
      return r.home === 0 || r.away === 0;
    case "OVER_2_5":
      return r.home + r.away >= 3;
    case "UNDER_2_5":
      return r.home + r.away <= 2;
  }
}

/** Statusi API-Footballa za završene utakmice (rezultat nakon 90 min je u score.fulltime). */
export const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
/** Statusi kod kojih se tip poništava. */
export const VOID_STATUSES = new Set(["PST", "CANC", "ABD", "AWD", "WO"]);
