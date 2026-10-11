import { describe, expect, it } from "vitest";
import {
  bookmakerMargin,
  poissonProbabilities,
  probabilitiesFromOdds,
  roundToHundred,
} from "./probability";

const sum = (p: { home: number; draw: number; away: number }) =>
  Math.round((p.home + p.draw + p.away) * 10) / 10;

describe("roundToHundred", () => {
  it("vraća jednu decimalu i zbroj 100", () => {
    const r = roundToHundred([1, 1, 1]);
    expect(r).toEqual([33.4, 33.3, 33.3]);
    expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });

  it("odbija nulti zbroj", () => {
    expect(() => roundToHundred([0, 0, 0])).toThrow();
  });
});

describe("probabilitiesFromOdds", () => {
  it("uklanja maržu i normalizira na 100 %", () => {
    // Implicirano: 0.5 + 0.2857 + 0.25 = 1.0357 → 3,6 % marže
    const p = probabilitiesFromOdds({ home: 2.0, draw: 3.5, away: 4.0 });
    expect(sum(p)).toBe(100);
    expect(p).toEqual({ home: 48.3, draw: 27.6, away: 24.1 });
  });

  it("bez marže vraća čiste implicirane vjerojatnosti", () => {
    const p = probabilitiesFromOdds({ home: 2, draw: 4, away: 4 });
    expect(p).toEqual({ home: 50, draw: 25, away: 25 });
  });

  it("jednaki koeficijenti daju podjelu na trećine", () => {
    const p = probabilitiesFromOdds({ home: 2.8, draw: 2.8, away: 2.8 });
    expect(p).toEqual({ home: 33.4, draw: 33.3, away: 33.3 });
  });

  it("niži koeficijent znači veću vjerojatnost", () => {
    const p = probabilitiesFromOdds({ home: 1.25, draw: 6.5, away: 11 });
    expect(p.home).toBeGreaterThan(p.draw);
    expect(p.draw).toBeGreaterThan(p.away);
    expect(sum(p)).toBe(100);
  });

  it("odbija neispravne koeficijente", () => {
    expect(() => probabilitiesFromOdds({ home: 1, draw: 3, away: 4 })).toThrow();
    expect(() => probabilitiesFromOdds({ home: Number.NaN, draw: 3, away: 4 })).toThrow();
    expect(() => probabilitiesFromOdds({ home: 0, draw: 3, away: 4 })).toThrow();
  });

  it("računa maržu kladionice", () => {
    expect(bookmakerMargin({ home: 2.0, draw: 3.5, away: 4.0 })).toBe(3.6);
  });
});

describe("poissonProbabilities", () => {
  const league = { homeGoalsPerGame: 1.5, awayGoalsPerGame: 1.2 };

  it("prosječne momčadi: λ jednak prosjeku lige, zbroj 100", () => {
    const r = poissonProbabilities(
      { played: 10, scored: 15, conceded: 12 },
      { played: 10, scored: 12, conceded: 15 },
      league,
    );
    expect(r.lambdaHome).toBeCloseTo(1.5, 5);
    expect(r.lambdaAway).toBeCloseTo(1.2, 5);
    expect(sum(r)).toBe(100);
    expect(r.home).toBeGreaterThan(r.away);
  });

  it("odgovara ručno izračunatom modelu za λ = 1.5 / 1.2", () => {
    // Neovisna referenca iz ručnog izračuna Poissonove matrice 0–10
    const r = poissonProbabilities(
      { played: 10, scored: 15, conceded: 12 },
      { played: 10, scored: 12, conceded: 15 },
      league,
    );
    // Referenca: 44,146 / 25,482 / 30,372 %
    expect(r.home).toBe(44.1);
    expect(r.draw).toBe(25.5);
    expect(r.away).toBe(30.4);
    expect(r.topScores[0]).toMatchObject({ home: 1, away: 1 });
  });

  it("simetrične momčadi uz jednak prosjek doma i vani daju jednake 1 i 2", () => {
    const eq = { homeGoalsPerGame: 1.3, awayGoalsPerGame: 1.3 };
    const r = poissonProbabilities(
      { played: 8, scored: 10, conceded: 10 },
      { played: 8, scored: 10, conceded: 10 },
      eq,
    );
    expect(Math.abs(r.home - r.away)).toBeLessThan(0.11);
  });

  it("jača momčad doma ima veću vjerojatnost pobjede", () => {
    const r = poissonProbabilities(
      { played: 10, scored: 30, conceded: 5 },
      { played: 10, scored: 6, conceded: 25 },
      league,
    );
    expect(r.home).toBeGreaterThan(70);
    expect(r.lambdaHome).toBeGreaterThan(r.lambdaAway);
    expect(sum(r)).toBe(100);
  });

  it("računa BTTS i više od 2,5 u rasponu 0–100", () => {
    const r = poissonProbabilities(
      { played: 5, scored: 10, conceded: 8 },
      { played: 5, scored: 9, conceded: 9 },
      league,
    );
    expect(r.btts).toBeGreaterThan(0);
    expect(r.btts).toBeLessThan(100);
    expect(r.over25).toBeGreaterThan(50);
  });

  it("momčad bez golova ne ruši model", () => {
    const r = poissonProbabilities(
      { played: 3, scored: 0, conceded: 6 },
      { played: 3, scored: 0, conceded: 0 },
      league,
    );
    expect(sum(r)).toBe(100);
    expect(r.lambdaHome).toBeGreaterThan(0);
  });

  it("odbija prazne podatke", () => {
    expect(() =>
      poissonProbabilities({ played: 0, scored: 0, conceded: 0 }, { played: 5, scored: 5, conceded: 5 }, league),
    ).toThrow();
    expect(() =>
      poissonProbabilities(
        { played: 5, scored: 5, conceded: 5 },
        { played: 5, scored: 5, conceded: 5 },
        { homeGoalsPerGame: 0, awayGoalsPerGame: 1 },
      ),
    ).toThrow();
  });
});
