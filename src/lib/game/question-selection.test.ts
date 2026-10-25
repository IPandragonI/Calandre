import { describe, expect, it } from "vitest";
import { availableCategories, availableMakes, carInCategory } from "./categories";
import { effectiveDifficulty, endlessMaxDifficulty, mixedPlan, parseDifficultyFilter, pickNextCar, selectQuestions } from "./question-selection";
import { createRandom } from "./random";
import { FIXTURE_CARS, makeCar } from "./test-fixtures";

const difficultyOf = (id: string) => FIXTURE_CARS.find((c) => c.id === id)!.difficulty;

describe("selectQuestions", () => {
  it("returns distinct cars, easiest first", () => {
    const ids = selectQuestions(FIXTURE_CARS, 10, createRandom(1));
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    const difficulties = ids.map(difficultyOf);
    expect([...difficulties].sort()).toEqual(difficulties);
  });

  it("returns only what the pool can supply, without duplicates", () => {
    const ids = selectQuestions(FIXTURE_CARS, 50, createRandom(2));
    expect(ids).toHaveLength(FIXTURE_CARS.length);
    expect(new Set(ids).size).toBe(FIXTURE_CARS.length);
  });

  it("prefers the chosen difficulty and only borrows from the neighbouring tier", () => {
    const easy = FIXTURE_CARS.filter((c) => c.difficulty === 1).length;
    expect(selectQuestions(FIXTURE_CARS, easy, createRandom(4), { difficulty: "easy" }).every((id) => difficultyOf(id) === 1)).toBe(true);
    const topped = selectQuestions(FIXTURE_CARS, 50, createRandom(4), { difficulty: "easy" });
    // Easy is topped up with medium cars, never hard ones: the game is shorter instead.
    expect(topped.length).toBe(FIXTURE_CARS.filter((c) => c.difficulty <= 2).length);
    expect(topped.some((id) => difficultyOf(id) === 2)).toBe(true);
    expect(topped.every((id) => difficultyOf(id) <= 2)).toBe(true);
    expect(selectQuestions(FIXTURE_CARS, 1, createRandom(4), { difficulty: "hard" }).map(difficultyOf)).toEqual([3]);
  });

  it("spreads a mixed game over every tier", () => {
    expect(mixedPlan(10)).toEqual({ 1: 4, 2: 4, 3: 2 });
    expect(mixedPlan(5)).toEqual({ 1: 2, 2: 2, 3: 1 });
    expect(Object.values(mixedPlan(7)).reduce((a, b) => a + b, 0)).toBe(7);
    const pool = Array.from({ length: 45 }, (_, i) => makeCar({ id: `c${i}`, make: `Make${i % 9}`, model: `M${i}`, difficulty: ((i % 3) + 1) as 1 | 2 | 3 }));
    const ids = selectQuestions(pool, 10, createRandom(3));
    const tiers = ids.map((id) => pool.find((c) => c.id === id)!.difficulty);
    expect(tiers.filter((d) => d === 1)).toHaveLength(4);
    expect(tiers.filter((d) => d === 3)).toHaveLength(2);
  });

  it("varies makes and model families within a game", () => {
    // 12 Volkswagens (6 Golf generations) and 12 cars from 12 other makes, all easy.
    const pool = [
      ...Array.from({ length: 6 }, (_, i) => makeCar({ id: `golf-${i}`, make: "Volkswagen", model: "Golf", generation: `Mk${i + 1}`, difficulty: 1 })),
      ...Array.from({ length: 6 }, (_, i) => makeCar({ id: `vw-${i}`, make: "Volkswagen", model: `Model${i}`, difficulty: 1 })),
      ...Array.from({ length: 12 }, (_, i) => makeCar({ id: `other-${i}`, make: `Brand${i}`, model: "One", difficulty: 1 })),
    ];
    for (const seed of [1, 2, 3, 4, 5]) {
      const cars = selectQuestions(pool, 10, createRandom(seed), { difficulty: "easy" }).map((id) => pool.find((c) => c.id === id)!);
      expect(cars.filter((c) => c.model === "Golf").length).toBeLessThanOrEqual(1);
      expect(cars.filter((c) => c.make === "Volkswagen").length).toBeLessThanOrEqual(3);
    }
    // A single-make pool (brand challenge) is not capped by make, but still one car per family.
    const vw = pool.filter((c) => c.make === "Volkswagen");
    const brand = selectQuestions(vw, 7, createRandom(1)).map((id) => vw.find((c) => c.id === id)!);
    expect(brand).toHaveLength(7);
    expect(brand.filter((c) => c.model === "Golf")).toHaveLength(1);
  });

  it("reads the former expert tier as hard, and rates generations a step harder", () => {
    expect(parseDifficultyFilter("expert")).toBe("hard");
    expect(parseDifficultyFilter("medium")).toBe("medium");
    expect(parseDifficultyFilter("silly")).toBeNull();
    expect(effectiveDifficulty({ difficulty: 1, generation: "IV" }, "generation")).toBe(2);
    expect(effectiveDifficulty({ difficulty: 3, generation: "IV" }, "generation")).toBe(3);
    expect(effectiveDifficulty({ difficulty: 1, generation: "IV" }, "classic")).toBe(1);
  });

  it("puts recently seen cars last", () => {
    const recent = FIXTURE_CARS.slice(0, 6).map((c) => c.id);
    const ids = selectQuestions(FIXTURE_CARS, 6, createRandom(5), { avoidIds: recent, difficulty: "mixed" });
    expect(ids.filter((id) => recent.includes(id)).length).toBeLessThanOrEqual(1);
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
    expect(pickNextCar(FIXTURE_CARS, seen, 3, state)[0]).not.toBeNull();
  });

  it("respects the difficulty ceiling while possible", () => {
    const [id] = pickNextCar(FIXTURE_CARS, [], 1, 99);
    expect(difficultyOf(id!)).toBe(1);
  });

  it("returns null for an empty dataset", () => {
    expect(pickNextCar([], [], 3, 1)[0]).toBeNull();
  });

  it("ramps endless difficulty up to hard", () => {
    expect([0, 5, 6, 14, 15, 40].map(endlessMaxDifficulty)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("avoids the make and model family of the last cars when it can", () => {
    const pool = [
      makeCar({ id: "golf-1", make: "Volkswagen", model: "Golf", generation: "Mk1", difficulty: 1 }),
      makeCar({ id: "golf-2", make: "Volkswagen", model: "Golf", generation: "Mk2", difficulty: 1 }),
      makeCar({ id: "polo", make: "Volkswagen", model: "Polo", difficulty: 1 }),
      makeCar({ id: "clio", make: "Renault", model: "Clio", difficulty: 1 }),
    ];
    for (const state of [1, 2, 3, 4, 5, 6]) expect(pickNextCar(pool, ["golf-1"], 1, state)[0]).toBe("clio");
  });
});

describe("categories", () => {
  it("match on region, country, style and body type", () => {
    const leaf = FIXTURE_CARS.find((c) => c.id === "nissan-leaf")!;
    expect(carInCategory(leaf, "japanese")).toBe(true);
    expect(carInCategory(leaf, "electric")).toBe(true);
    expect(carInCategory(FIXTURE_CARS.find((c) => c.id === "citroen-2cv")!, "france")).toBe(true);
    expect(carInCategory(makeCar({ id: "x", make: "Jeep", model: "Wrangler", bodyType: "offroad" }), "suv")).toBe(true);
    expect(carInCategory(makeCar({ id: "y", make: "Bugatti", model: "Chiron", tags: ["hypercar"] }), "supercar")).toBe(true);
  });

  it("only lists categories and brands with enough cars", () => {
    const ids = availableCategories(FIXTURE_CARS).map((c) => c.id);
    expect(ids).toContain("european");
    expect(ids).not.toContain("korean");
    expect(availableCategories([])).toEqual([]);
    expect(availableMakes(FIXTURE_CARS, 3)).toEqual([{ make: "BMW", count: 3 }]);
  });
});
