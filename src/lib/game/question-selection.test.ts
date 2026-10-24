import { describe, expect, it } from "vitest";
import { availableCategories, carInCategory } from "./categories";
import { endlessMaxDifficulty, pickNextCar, selectQuestions } from "./question-selection";
import { createRandom } from "./random";
import { FIXTURE_CARS } from "./test-fixtures";

describe("selectQuestions", () => {
  it("returns distinct cars, easiest first", () => {
    const ids = selectQuestions(FIXTURE_CARS, 10, createRandom(1));
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    const difficulties = ids.map((id) => FIXTURE_CARS.find((c) => c.id === id)!.difficulty);
    expect([...difficulties].sort()).toEqual(difficulties);
  });

  it("returns only what the pool can supply, without duplicates", () => {
    const ids = selectQuestions(FIXTURE_CARS, 50, createRandom(2));
    expect(ids).toHaveLength(FIXTURE_CARS.length);
    expect(new Set(ids).size).toBe(FIXTURE_CARS.length);
  });

  it("applies the category as a hard filter", () => {
    const ids = selectQuestions(FIXTURE_CARS, 10, createRandom(3), { category: "japanese" });
    expect(ids.length).toBe(3);
    for (const id of ids) expect(carInCategory(FIXTURE_CARS.find((c) => c.id === id)!, "japanese")).toBe(true);
  });

  it("prefers the chosen difficulty and tops up when it runs short", () => {
    const easyCount = FIXTURE_CARS.filter((c) => c.difficulty === 1).length;
    const ids = selectQuestions(FIXTURE_CARS, easyCount, createRandom(4), { difficulty: "easy" });
    expect(ids.every((id) => FIXTURE_CARS.find((c) => c.id === id)!.difficulty === 1)).toBe(true);
    expect(selectQuestions(FIXTURE_CARS, easyCount + 2, createRandom(4), { difficulty: "easy" })).toHaveLength(easyCount + 2);
  });

  it("puts recently seen cars last", () => {
    const recent = FIXTURE_CARS.slice(0, 6).map((c) => c.id);
    const ids = selectQuestions(FIXTURE_CARS, 6, createRandom(5), { avoidIds: recent });
    expect(ids.some((id) => recent.includes(id))).toBe(false);
  });

  it("is deterministic for a given seed and handles an empty dataset", () => {
    expect(selectQuestions(FIXTURE_CARS, 5, createRandom(42))).toEqual(selectQuestions(FIXTURE_CARS, 5, createRandom(42)));
    expect(selectQuestions([], 10, createRandom(1))).toEqual([]);
  });
});

describe("pickNextCar", () => {
  it("avoids repeats until every car has been shown", () => {
    const seen: string[] = [];
    let state = 7;
    for (let i = 0; i < FIXTURE_CARS.length; i++) {
      const [id, next] = pickNextCar(FIXTURE_CARS, seen, 3, state);
      expect(id).not.toBeNull();
      expect(seen).not.toContain(id);
      seen.push(id!);
      state = next;
    }
    const [again] = pickNextCar(FIXTURE_CARS, seen, 3, state);
    expect(again).not.toBeNull();
  });

  it("respects the difficulty ceiling while possible", () => {
    const [id] = pickNextCar(FIXTURE_CARS, [], 1, 99);
    expect(FIXTURE_CARS.find((c) => c.id === id)!.difficulty).toBe(1);
  });

  it("returns null for an empty dataset", () => {
    expect(pickNextCar([], [], 3, 1)[0]).toBeNull();
  });

  it("ramps endless difficulty up", () => {
    expect(endlessMaxDifficulty(0)).toBe(1);
    expect(endlessMaxDifficulty(6)).toBe(2);
    expect(endlessMaxDifficulty(20)).toBe(3);
  });
});

describe("availableCategories", () => {
  it("only lists categories with enough cars", () => {
    const ids = availableCategories(FIXTURE_CARS).map((c) => c.id);
    expect(ids).toContain("european");
    expect(ids).not.toContain("japanese");
    expect(ids).not.toContain("rare");
    expect(availableCategories([])).toEqual([]);
  });
});
