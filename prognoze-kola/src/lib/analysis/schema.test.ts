import { describe, expect, it } from "vitest";
import { extractJson } from "./json";
import { AiMatchSchema } from "./types";

const valid = {
  verdict: "Domaćin bi trebao kontrolirati utakmicu i slomiti gosta u drugom poluvremenu.",
  mainTip: { home: 2, away: 1 },
  extraTip: { market: "OVER_2_5" },
  reasons: ["Domaćin je 2. s 21 bodom.", "Gost ima 1 pobjedu u zadnjih 5.", "Koeficijenti daju 1 = 55,2 %."],
  note: "",
  sources: [{ title: "Najava", url: "https://example.com/najava" }],
};

describe("AiMatchSchema", () => {
  it("prihvaća ispravan odgovor", () => {
    expect(AiMatchSchema.safeParse(valid).success).toBe(true);
  });

  it("odbija premalo razloga, nepoznato tržište i višak polja", () => {
    expect(AiMatchSchema.safeParse({ ...valid, reasons: ["Samo jedan razlog."] }).success).toBe(false);
    expect(AiMatchSchema.safeParse({ ...valid, extraTip: { market: "HANDICAP" } }).success).toBe(false);
    expect(AiMatchSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    expect(AiMatchSchema.safeParse({ ...valid, mainTip: { home: 1.5, away: 0 } }).success).toBe(false);
  });
});

describe("extractJson", () => {
  it("čita JSON iz markdown ograde", () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("vraća null za neispravan tekst", () => {
    expect(extractJson("nema jsona")).toBeNull();
    expect(extractJson("{neispravno}")).toBeNull();
  });
});
