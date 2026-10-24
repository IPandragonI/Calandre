import { describe, expect, it } from "vitest";
import { dailyCarIds, dailyNumber, DAILY_QUESTION_COUNT, localDateKey } from "./daily-challenge";
import { FIXTURE_CARS } from "./test-fixtures";

describe("daily challenge", () => {
  it("is identical for the same date, however often it is computed", () => {
    const first = dailyCarIds(FIXTURE_CARS, "2026-10-24");
    expect(first).toHaveLength(DAILY_QUESTION_COUNT);
    expect(new Set(first).size).toBe(DAILY_QUESTION_COUNT);
    for (let i = 0; i < 5; i++) expect(dailyCarIds(FIXTURE_CARS, "2026-10-24")).toEqual(first);
  });

  it("does not depend on the order of the dataset", () => {
    expect(dailyCarIds([...FIXTURE_CARS].reverse(), "2026-10-24")).toEqual(dailyCarIds(FIXTURE_CARS, "2026-10-24"));
  });

  it("changes from one day to the next", () => {
    const days = ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"].map((d) => dailyCarIds(FIXTURE_CARS, d).join());
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it("uses the local calendar date", () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(localDateKey(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31");
  });

  it("numbers challenges from 2026-01-01", () => {
    expect(dailyNumber("2026-01-01")).toBe(1);
    expect(dailyNumber("2026-10-24")).toBe(297);
  });
});
