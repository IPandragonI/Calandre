import { describe, expect, it } from "vitest";
import { FIXTURE_CARS, makeCar } from "@/lib/game/test-fixtures";
import { fr } from "@/lib/i18n/fr";
import { en } from "@/lib/i18n/en";
import { acceptedAnswersFor } from "@/lib/game/answer-validation";
import { availableCategories } from "@/lib/game/categories";
import { CARS, carName, hintsFor, parseDataset } from "./dataset";

describe("parseDataset", () => {
  it("accepts valid entries", () => {
    expect(parseDataset(FIXTURE_CARS)).toEqual({ cars: FIXTURE_CARS, errors: [] });
  });

  it("handles an empty or non-array dataset", () => {
    expect(parseDataset([])).toEqual({ cars: [], errors: [] });
    expect(parseDataset({ cars: [] }).cars).toEqual([]);
    expect(parseDataset(null).errors).toHaveLength(1);
  });

  it("drops invalid and duplicate entries but keeps the rest", () => {
    const valid = makeCar({ id: "ok", make: "Fiat", model: "Panda" });
    const { cars, errors } = parseDataset([
      valid,
      { ...valid, id: "Bad Id" },
      { ...valid, id: "no-image", image: undefined },
      { ...valid, id: "no-license", image: { ...valid.image, license: "" } },
      { ...valid, id: "remote", image: { ...valid.image, src: "https://example.com/x" } },
      { ...valid, id: "bad-year", years: { from: 1700, to: null } },
      { ...valid, id: "untranslated", funFact: { fr: "Seulement en français" } },
      valid,
      "nonsense",
    ]);
    expect(cars).toEqual([valid]);
    expect(errors).toHaveLength(8);
  });
});

describe("helpers", () => {
  const car = FIXTURE_CARS[0];
  it("formats names with the generation", () => {
    expect(carName(car)).toBe("BMW M3 (E46)");
    expect(carName({ make: "Ford", model: "GT40" })).toBe("Ford GT40");
  });

  it("builds four localised hints", () => {
    expect(hintsFor(car, fr, "fr")).toEqual(["Le constructeur est BMW.", "Produite de 1990 à 2000.", "C'est un coupé.", "Indice."]);
    expect(hintsFor(car, en, "en")[0]).toBe("The manufacturer is BMW.");
  });
});

describe("bundled dataset", () => {
  it("is valid and has unique, unambiguous answers", () => {
    expect(CARS.length).toBeGreaterThan(0);
    const owner = new Map<string, string>();
    for (const c of CARS) {
      for (const { normalized } of acceptedAnswersFor(c)) {
        expect(owner.get(normalized) ?? c.id, `"${normalized}" is accepted for two cars`).toBe(c.id);
        owner.set(normalized, c.id);
      }
    }
  });

  it("only uses local images with attribution", () => {
    for (const c of CARS) {
      expect(c.image.src.startsWith("/cars/")).toBe(true);
      expect(c.image.sourcePage).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });

  it("offers several categories", () => {
    expect(availableCategories(CARS).length).toBeGreaterThanOrEqual(5);
  });
});
