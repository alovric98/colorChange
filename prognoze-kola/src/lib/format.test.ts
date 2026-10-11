import { describe, expect, it } from "vitest";
import { formatPercent, pointsLabel, roundLabel, teamColor, teamShort } from "./format";

describe("format", () => {
  it("hrvatska množina za bodove", () => {
    expect(pointsLabel(1)).toBe("1 bod");
    expect(pointsLabel(3)).toBe("3 boda");
    expect(pointsLabel(5)).toBe("5 bodova");
    expect(pointsLabel(11)).toBe("11 bodova");
    expect(pointsLabel(12)).toBe("12 bodova");
    expect(pointsLabel(21)).toBe("21 bod");
    expect(pointsLabel(22)).toBe("22 boda");
    expect(pointsLabel(0)).toBe("0 bodova");
  });

  it("postotak s decimalnim zarezom", () => {
    expect(formatPercent(48.3)).toBe("48,3 %");
    expect(formatPercent(50)).toBe("50,0 %");
  });

  it("skraćenice", () => {
    expect(teamShort("Liverpool")).toBe("LIV");
    expect(teamShort("Manchester City")).toBe("MCI");
    expect(teamShort("Unknown Town FC")).toBe("UTO");
    expect(teamShort("NK Šibenik")).toBe("SIB");
  });

  it("stabilna boja za nepoznat klub", () => {
    expect(teamColor("Neki Klub")).toBe(teamColor("Neki Klub"));
    expect(teamColor("Liverpool")).toBe("#C8102E");
  });

  it("oznaka kola", () => {
    expect(roundLabel("Regular Season - 8")).toBe("8. kolo");
    expect(roundLabel("League Stage - 3")).toBe("3. kolo");
    expect(roundLabel("Round of 16")).toBe("Round of 16");
    expect(roundLabel(null)).toBeNull();
  });
});
