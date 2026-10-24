import rawCars from "@/data/cars.json";
import type { BodyType, Car, CarImage, CarTag, Locale, Localized, Region } from "@/types/car";
import type { Messages } from "@/lib/i18n";
import { isRecord } from "@/lib/storage/storage-schema";

const REGIONS: readonly Region[] = ["europe", "japan", "usa", "korea"];
const BODY_TYPES: readonly BodyType[] = [
  "coupe",
  "sedan",
  "hatchback",
  "convertible",
  "roadster",
  "suv",
  "offroad",
  "wagon",
  "van",
  "race-car",
];
const TAGS: readonly CarTag[] = ["sports", "supercar", "classic", "electric", "racing", "everyday", "rare"];

const isString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isLocalized = (v: unknown): v is Localized => isRecord(v) && isString(v.fr) && isString(v.en);
const isYear = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1880 && v <= 2100;

function imageProblem(value: unknown): string | null {
  if (!isRecord(value)) return "image missing";
  if (!isString(value.src) || !value.src.startsWith("/")) return "image.src must be a local path";
  if (typeof value.width !== "number" || typeof value.height !== "number") return "image size missing";
  if (!isLocalized(value.alt)) return "image.alt must be localised";
  if (!isString(value.sourcePage) || !isString(value.author) || !isString(value.license)) {
    return "image attribution (sourcePage, author, license) missing";
  }
  return null;
}

/** Returns why an entry is invalid, or null when it is a valid Car. */
export function carProblem(value: unknown): string | null {
  if (!isRecord(value)) return "not an object";
  if (!isString(value.id) || !/^[a-z0-9-]+$/.test(value.id)) return "invalid id";
  if (!isString(value.make) || !isString(value.model)) return "make and model required";
  if (value.generation !== undefined && !isString(value.generation)) return "invalid generation";
  if (!isRecord(value.years) || !isYear(value.years.from) || !(value.years.to === null || isYear(value.years.to))) {
    return "invalid years";
  }
  if (!REGIONS.includes(value.region as Region)) return "invalid region";
  if (!BODY_TYPES.includes(value.bodyType as BodyType)) return "invalid bodyType";
  if (!Array.isArray(value.tags) || !value.tags.every((t) => TAGS.includes(t as CarTag))) return "invalid tags";
  if (![1, 2, 3].includes(value.difficulty as number)) return "invalid difficulty";
  if (!Array.isArray(value.acceptedAnswers) || !value.acceptedAnswers.every(isString)) return "invalid acceptedAnswers";
  if (!isLocalized(value.clue) || !isLocalized(value.funFact)) return "clue and funFact must be localised";
  return imageProblem(value.image);
}

/**
 * Validates raw dataset entries. Invalid or duplicate entries are dropped
 * (and reported) rather than breaking the game.
 */
export function parseDataset(raw: unknown): { cars: Car[]; errors: string[] } {
  if (!Array.isArray(raw)) return { cars: [], errors: ["dataset is not an array"] };
  const cars: Car[] = [];
  const errors: string[] = [];
  const ids = new Set<string>();
  raw.forEach((entry, index) => {
    const problem = carProblem(entry);
    const id = isRecord(entry) && typeof entry.id === "string" ? entry.id : `#${index}`;
    if (problem) errors.push(`${id}: ${problem}`);
    else if (ids.has(id)) errors.push(`${id}: duplicate id`);
    else {
      ids.add(id);
      cars.push(entry as Car);
    }
  });
  return { cars, errors };
}

const parsed = parseDataset(rawCars);
if (parsed.errors.length > 0 && process.env.NODE_ENV !== "production") {
  console.warn(`[calandre] ${parsed.errors.length} invalid car entries ignored:\n${parsed.errors.join("\n")}`);
}

export const CARS: readonly Car[] = parsed.cars;

/** "BMW M3 (E46)" */
export function carName(car: Pick<Car, "make" | "model" | "generation">): string {
  return car.generation ? `${car.make} ${car.model} (${car.generation})` : `${car.make} ${car.model}`;
}

/** The four progressive hints, in the player's language. */
export function hintsFor(car: Car, t: Messages, locale: Locale): string[] {
  return [
    t.game.hintMake(car.make),
    t.game.hintPeriod(car.years.from, car.years.to),
    t.game.hintBody(t.bodyTypes[car.bodyType]),
    car.clue[locale],
  ];
}

export function imageRendition(image: Pick<CarImage, "src">, width: 640 | 1200): string {
  return `${image.src}-${width}.webp`;
}
