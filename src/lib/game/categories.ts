import type { BodyType, Car, CarTag, Region } from "@/types/car";

/** Grouped for display: origins first, then styles. */
export const ORIGIN_CATEGORIES = [
  "european",
  "france",
  "germany",
  "italy",
  "uk",
  "sweden",
  "japanese",
  "american",
  "korean",
  "chinese",
] as const;

export const STYLE_CATEGORIES = [
  "supercar",
  "sports",
  "hot-hatch",
  "luxury",
  "classic",
  "electric",
  "racing",
  "suv",
  "everyday",
  "concept",
  "rare",
] as const;

export const CATEGORY_IDS = [...ORIGIN_CATEGORIES, ...STYLE_CATEGORIES] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

/** A category (or brand) with fewer cars than this is never offered. */
export const MIN_CATEGORY_SIZE = 5;

type CategorizableCar = Pick<Car, "region" | "tags" | "country" | "bodyType">;

const REGION_CATEGORIES: Partial<Record<CategoryId, Region>> = {
  european: "europe",
  japanese: "japan",
  american: "usa",
  korean: "korea",
  chinese: "china",
};

const COUNTRY_CATEGORIES: Partial<Record<CategoryId, string>> = {
  france: "FR",
  germany: "DE",
  italy: "IT",
  uk: "GB",
  sweden: "SE",
};

const TAG_CATEGORIES: Partial<Record<CategoryId, CarTag[]>> = {
  supercar: ["supercar", "hypercar"],
  sports: ["sports"],
  "hot-hatch": ["hot-hatch"],
  luxury: ["luxury"],
  classic: ["classic"],
  electric: ["electric"],
  racing: ["racing"],
  everyday: ["everyday"],
  concept: ["concept"],
  rare: ["rare"],
};

const BODY_CATEGORIES: Partial<Record<CategoryId, BodyType[]>> = {
  suv: ["suv", "offroad", "pickup"],
};

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function carInCategory(car: CategorizableCar, category: CategoryId): boolean {
  const region = REGION_CATEGORIES[category];
  if (region) return car.region === region;
  const country = COUNTRY_CATEGORIES[category];
  if (country) return car.country === country;
  const bodies = BODY_CATEGORIES[category];
  if (bodies) return car.bodyType !== undefined && bodies.includes(car.bodyType);
  const tags = TAG_CATEGORIES[category];
  return tags !== undefined && tags.some((t) => car.tags.includes(t));
}

/** Categories backed by enough cars in the catalogue, in display order. */
export function availableCategories(
  cars: readonly CategorizableCar[],
  ids: readonly CategoryId[] = CATEGORY_IDS,
): { id: CategoryId; count: number }[] {
  return ids.map((id) => ({ id, count: cars.filter((car) => carInCategory(car, id)).length })).filter((c) => c.count >= MIN_CATEGORY_SIZE);
}

export function categoriesOf(car: CategorizableCar): CategoryId[] {
  return CATEGORY_IDS.filter((id) => carInCategory(car, id));
}

/** Brands with enough cars for a brand challenge, most represented first. */
export function availableMakes(cars: readonly Pick<Car, "make">[], minimum = 8): { make: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const car of cars) counts.set(car.make, (counts.get(car.make) ?? 0) + 1);
  return [...counts]
    .filter(([, count]) => count >= minimum)
    .map(([make, count]) => ({ make, count }))
    .sort((a, b) => b.count - a.count || a.make.localeCompare(b.make));
}
