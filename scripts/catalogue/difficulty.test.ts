import { describe, expect, it } from "vitest";
import type { Car } from "../../src/types/car";
import type { Entity } from "../lib/wikidata";
import { classifyCar, familyWeight, firstYear, gatherSignals, recognitionScore, tierFor, type Signals } from "./difficulty";

const signals = (over: Partial<Signals> = {}): Signals => ({
  views: 0,
  familyViews: 0,
  brandViews: 0,
  sitelinks: 5,
  familySitelinks: 0,
  produced: null,
  startYear: null,
  relation: "model",
  tags: [],
  ...over,
});
const car = (over: Partial<Car> = {}) => ({ id: "q1", make: "Renault", model: "Clio", ...over });

describe("recognitionScore", () => {
  it("rates a widely read model easy and an obscure one hard", () => {
    const clio = recognitionScore(signals({ views: 600_000, sitelinks: 60, brandViews: 800_000 }));
    const obscure = recognitionScore(signals({ views: 4_000, sitelinks: 6, brandViews: 20_000 }));
    expect(tierFor(clio.score, [])).toBe(1);
    expect(tierFor(obscure.score, [])).toBe(3);
    expect(clio.why).toMatch(/popularity \+\d+/);
  });

  it("is not simply about age: a famous old car beats an obscure new one", () => {
    const beetle = recognitionScore(signals({ views: 500_000, sitelinks: 70, startYear: 1938 }));
    const crossover = recognitionScore(signals({ views: 8_000, sitelinks: 8, startYear: 2022 }));
    expect(beetle.score).toBeGreaterThan(crossover.score);
  });

  it("lets a generation borrow its family's fame, less so when it is old", () => {
    const recent = recognitionScore(signals({ relation: "generation", familyViews: 500_000, familySitelinks: 60, startYear: 2019 }));
    const old = recognitionScore(signals({ relation: "generation", familyViews: 500_000, familySitelinks: 60, startYear: 1976 }));
    expect(recent.score).toBeGreaterThan(old.score);
    expect(familyWeight("model", 2019)).toBe(0);
    expect(familyWeight("variant", 2019)).toBeLessThan(familyWeight("generation", 2019));
  });

  it("applies stated production, era and type adjustments", () => {
    const base = recognitionScore(signals({ views: 60_000, sitelinks: 25 })).score;
    expect(recognitionScore(signals({ views: 60_000, sitelinks: 25, produced: 2_000_000 })).score).toBeGreaterThan(base);
    expect(recognitionScore(signals({ views: 60_000, sitelinks: 25, produced: 400 })).score).toBeLessThan(base);
    expect(recognitionScore(signals({ views: 60_000, sitelinks: 25, startYear: 1925 })).score).toBeLessThan(base);
    expect(tierFor(90, ["concept"])).toBe(3);
    expect(tierFor(90, ["racing"])).toBe(2);
  });
});

describe("classifyCar", () => {
  const curated = { models: { easy: ["Renault Clio"], hard: ["Renault Vivastella"] }, cars: { q9: 2 as const } };

  it("uses curated tiers for important models", () => {
    expect(classifyCar(car(), signals({ views: 5_000 }), curated).difficulty).toBe(2); // computed hard → at most medium
    expect(classifyCar(car({ generation: "V" }), signals({ startYear: 2019, views: 200_000, sitelinks: 30 }), curated).difficulty).toBe(1);
    expect(classifyCar(car({ generation: "I" }), signals({ startYear: 1990, views: 200_000, sitelinks: 30 }), curated).difficulty).toBe(1);
    expect(classifyCar(car({ generation: "Mk1" }), signals({ startYear: 1972, views: 200_000 }), curated).difficulty).toBe(2);
    expect(classifyCar(car({ model: "Vivastella" }), signals({ views: 900_000, sitelinks: 80 }), curated).difficulty).toBe(3);
    expect(classifyCar(car({ id: "q9", model: "Kangoo" }), signals(), curated).difficulty).toBe(2);
  });

  it("falls back to the score for everything else", () => {
    const r = classifyCar(car({ model: "Fuego" }), signals({ views: 30_000, sitelinks: 20 }), curated);
    expect(r.difficulty).toBe(tierFor(r.score, []));
    expect(r.why).not.toContain("curated");
  });
});

describe("signals", () => {
  it("finds the first plausible year in an intro", () => {
    expect(firstYear("The Bugatti Type 57 was produced from 1934 through 1940.")).toBe(1934);
    expect(firstYear("La Renault 5 E-Tech est une citadine.")).toBeNull();
    expect(firstYear(undefined)).toBeNull();
  });

  it("gathers views of the car, its family and its brand, and sibling families", () => {
    const entities = new Map<string, Entity>([
      ["Q1", { id: "Q1", claims: { P179: [{ mainsnak: { datavalue: { value: { id: "Q10" } } }, rank: "normal" }], P1716: [{ mainsnak: { datavalue: { value: { id: "Q20" } } }, rank: "normal" }] } }],
      ["Q2", { id: "Q2" }],
      ["Q10", { id: "Q10", sitelinks: { enwiki: { title: "Renault Clio" } } }],
      ["Q20", { id: "Q20", sitelinks: { frwiki: { title: "Renault" } } }],
    ]);
    const cars = [
      { id: "q1", make: "Renault", model: "Clio", generation: "IV", wikidata: "Q1", tags: [], links: { en: "https://en.wikipedia.org/wiki/Renault_Clio_IV" } },
      { id: "q2", make: "Renault", model: "Clio", generation: "V", wikidata: "Q2", tags: [], years: { from: 2019, to: null } },
    ] as unknown as Car[];
    const views: Record<string, number> = { "en:Renault Clio IV": 1_000, "en:Renault Clio": 300_000, "fr:Renault": 90_000 };
    const out = gatherSignals(cars, {
      entities,
      itemOf: (c) => c.wikidata,
      views: (wiki, title) => views[`${wiki}:${title}`] ?? 0,
      sitelinks: (item) => (item === "Q1" ? { item: 12, series: 55 } : undefined),
      extracts: { fr: {}, en: { "Renault Clio IV": "The Renault Clio IV was launched in 2012." } },
    });
    expect(out.get("q1")).toMatchObject({ views: 1_000, familyViews: 300_000, brandViews: 90_000, sitelinks: 12, familySitelinks: 55, startYear: 2012, relation: "generation" });
    // No "part of the series" on its own item: borrows the family of its sibling generation.
    expect(out.get("q2")).toMatchObject({ familyViews: 300_000, startYear: 2019, relation: "generation" });
  });
});
