import { describe, expect, it } from "vitest";
import { addDays, dayLabel, isSelectableDay, selectableDays, zagrebDate, zagrebHour } from "./dates";

describe("dates", () => {
  it("računa datum u Zagrebu, ne u UTC-u", () => {
    // 23:30 UTC 11.10. je već 12.10. u Zagrebu (CEST, UTC+2)
    expect(zagrebDate(new Date("2026-10-11T23:30:00Z"))).toBe("2026-10-12");
    expect(zagrebDate(new Date("2026-10-11T21:30:00Z"))).toBe("2026-10-11");
  });

  it("08:00 po Zagrebu u ljetnom i zimskom vremenu", () => {
    expect(zagrebHour(new Date("2026-07-01T06:00:00Z"))).toBe(8);
    expect(zagrebHour(new Date("2026-12-01T07:00:00Z"))).toBe(8);
    expect(zagrebHour(new Date("2026-12-01T06:00:00Z"))).toBe(7);
  });

  it("dodaje dane preko kraja mjeseca", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });

  it("nudi danas + 6 dana", () => {
    const days = selectableDays("2026-10-11");
    expect(days).toHaveLength(7);
    expect(days[6]).toBe("2026-10-17");
    expect(isSelectableDay("2026-10-17", "2026-10-11")).toBe(true);
    expect(isSelectableDay("2026-10-18", "2026-10-11")).toBe(false);
    expect(isSelectableDay("nije-datum", "2026-10-11")).toBe(false);
  });

  it("oznake dana", () => {
    expect(dayLabel("2026-10-11", "2026-10-11")).toBe("Danas");
    expect(dayLabel("2026-10-12", "2026-10-11")).toBe("Sutra");
    expect(dayLabel("2026-10-13", "2026-10-11")).toBe("uto 13.10.");
  });
});
