import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIXTURE_CARS, makeCar } from "@/lib/game/test-fixtures";
import { fr } from "@/lib/i18n/fr";
import { en } from "@/lib/i18n/en";
import { acceptedAnswersFor, modelKey } from "@/lib/game/answer-validation";
import { availableCategories } from "@/lib/game/categories";
import { attribution, carName, formatYears, hintKinds, hintsFor, imageSrcSet, parseDataset, thumbnailUrl } from "./dataset";

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
      { ...valid, id: "local-photo", image: { ...valid.image, url: "/cars/photo.webp" } },
      { ...valid, id: "bad-year", years: { from: 1700, to: null } },
      { ...valid, id: "untranslated", funFact: { fr: "Seulement en français" } },
      { ...valid, id: "no-country", country: "France" },
      valid,
      "nonsense",
    ]);
    expect(cars).toEqual([valid]);
    expect(errors).toHaveLength(9);
  });

  it("accepts entries without years, body type or clue", () => {
    const bare = makeCar({ id: "bare", make: "Lada", model: "Niva", years: undefined, bodyType: undefined, clue: undefined, funFact: undefined });
    expect(parseDataset([bare]).errors).toEqual([]);
  });
});

describe("helpers", () => {
  const car = FIXTURE_CARS[0];
  it("formats names and years", () => {
    expect(carName(car)).toBe("BMW M3 (E46)");
    expect(carName({ make: "Ford", model: "GT40" })).toBe("Ford GT40");
    expect(formatYears(car)).toBe("1990 – 2000");
    expect(formatYears({ years: undefined })).toBeNull();
  });

  it("builds only the hints the data supports", () => {
    expect(hintsFor(car, fr, "fr").map((h) => h.text)).toEqual([
      "Le constructeur est BMW.",
      "Produite de 1990 à 2000.",
      "C'est un coupé.",
      "Indice.",
    ]);
    expect(hintsFor(car, en, "en")[0].text).toBe("The manufacturer is BMW.");
    expect(hintKinds({ years: undefined, bodyType: undefined, clue: undefined })).toEqual(["make"]);
  });

  it("derives Wikimedia thumbnail sizes from the image URL", () => {
    const image = { url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Car.jpg/1280px-Car.jpg" };
    expect(thumbnailUrl(image, 330)).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Car.jpg/330px-Car.jpg");
    expect(imageSrcSet(image)).toContain("960px-Car.jpg 960w");
    // Originals smaller than the display width are used as they are.
    const original = { url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Car.jpg" };
    expect(thumbnailUrl(original, 330)).toBe(original.url);
    expect(imageSrcSet(original)).toBeUndefined();
    expect(attribution({ author: "Jane", license: "CC BY 2.0" })).toBe("Jane, CC BY 2.0, via Wikimedia Commons");
  });
});

describe("generated catalogue (public/catalogue.json)", () => {
  const raw: unknown = JSON.parse(readFileSync(new URL("../../../public/catalogue.json", import.meta.url), "utf8"));
  const { cars, errors } = parseDataset(raw);

  it("is valid", () => {
    expect(errors).toEqual([]);
    expect(cars.length).toBeGreaterThan(500);
  });

  it("only uses remote Wikimedia images with attribution", () => {
    for (const c of cars) {
      // Commons serves files from upload.wikimedia.org and thumbnails from thumb.wikimedia.org.
      expect(c.image.url, c.id).toMatch(/^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/[^?#]+$/);
      expect(c.image.sourcePage, c.id).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(c.image.author.length, c.id).toBeGreaterThan(0);
    }
  });

  it("has no duplicate cars or photos", () => {
    const ids = new Set(cars.map((c) => c.id));
    expect(ids.size).toBe(cars.length);
    const photos = new Set(cars.map((c) => c.image.url));
    expect(photos.size).toBe(cars.length);
    const names = new Set(cars.map((c) => carName(c).toLowerCase()));
    expect(names.size).toBe(cars.length);
  });

  it("never accepts the same precise answer for two cars, nor a shared alias across models", () => {
    const owner = new Map<string, string>();
    for (const c of cars) {
      for (const { normalized, precise } of acceptedAnswersFor(c)) {
        const key = `${precise ? "p" : "b"}:${normalized}`;
        const previous = owner.get(key);
        if (previous && precise) expect.fail(`"${normalized}" is accepted for ${previous} and ${c.id}`);
        // Non-precise answers may be shared only by generations of one model.
        if (previous && !precise) {
          const other = cars.find((x) => x.id === previous)!;
          expect(modelKey(other), `"${normalized}" shared by ${previous} and ${c.id}`).toBe(modelKey(c));
        }
        owner.set(key, c.id);
      }
    }
  });

  it("offers many categories across difficulties", () => {
    expect(availableCategories(cars).length).toBeGreaterThanOrEqual(15);
    for (const level of [1, 2, 3]) expect(cars.filter((c) => c.difficulty === level).length).toBeGreaterThan(30);
  });
});
