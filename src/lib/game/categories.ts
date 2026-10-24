import type { Car, CarTag, Region } from "@/types/car";

export const CATEGORY_IDS = [
  "european",
  "japanese",
  "american",
  "supercar",
  "sports",
  "classic",
  "electric",
  "racing",
  "everyday",
  "rare",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

/** A category with fewer cars than this is never offered. */
export const MIN_CATEGORY_SIZE = 5;

const REGION_CATEGORIES: Partial<Record<CategoryId, Region>> = {
  european: "europe",
  japanese: "japan",
  american: "usa",
};

const TAG_CATEGORIES: Partial<Record<CategoryId, CarTag>> = {
  supercar: "supercar",
  sports: "sports",
  classic: "classic",
  electric: "electric",
  racing: "racing",
  everyday: "everyday",
  rare: "rare",
};

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function carInCategory(car: Pick<Car, "region" | "tags">, category: CategoryId): boolean {
  const region = REGION_CATEGORIES[category];
  if (region) return car.region === region;
  const tag = TAG_CATEGORIES[category];
  return tag !== undefined && car.tags.includes(tag);
}

/** Categories backed by enough cars in the dataset, in display order. */
export function availableCategories(cars: readonly Pick<Car, "region" | "tags">[]): { id: CategoryId; count: number }[] {
  return CATEGORY_IDS.map((id) => ({ id, count: cars.filter((car) => carInCategory(car, id)).length })).filter(
    (c) => c.count >= MIN_CATEGORY_SIZE,
  );
}

export function categoriesOf(car: Pick<Car, "region" | "tags">): CategoryId[] {
  return CATEGORY_IDS.filter((id) => carInCategory(car, id));
}
