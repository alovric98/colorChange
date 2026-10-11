import { describe, expect, it } from "vitest";
import { isExtraTipHit, isMainTipHit } from "./tips";

describe("isMainTipHit", () => {
  it("pogađa samo točan rezultat", () => {
    expect(isMainTipHit({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe(true);
    expect(isMainTipHit({ home: 2, away: 1 }, { home: 1, away: 2 })).toBe(false);
  });
});

describe("isExtraTipHit", () => {
  const cases: [Parameters<typeof isExtraTipHit>[0], number, number, boolean][] = [
    ["1X", 1, 1, true],
    ["1X", 0, 1, false],
    ["X2", 0, 0, true],
    ["X2", 2, 1, false],
    ["12", 1, 1, false],
    ["12", 3, 1, true],
    ["BTTS_YES", 1, 1, true],
    ["BTTS_YES", 2, 0, false],
    ["BTTS_NO", 0, 3, true],
    ["BTTS_NO", 1, 2, false],
    ["OVER_2_5", 2, 1, true],
    ["OVER_2_5", 1, 1, false],
    ["UNDER_2_5", 1, 1, true],
    ["UNDER_2_5", 3, 0, false],
  ];
  it.each(cases)("%s kod %i:%i → %s", (market, h, a, expected) => {
    expect(isExtraTipHit(market, { home: h, away: a })).toBe(expected);
  });
});
