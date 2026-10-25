import type { BodyType, Car, CarImage, CarTag, Locale, Localized, Region } from "@/types/car";
import type { Messages } from "@/lib/i18n";
import { isRecord } from "@/lib/storage/storage-schema";

const REGIONS: readonly Region[] = ["europe", "japan", "usa", "korea", "china", "other"];
export const BODY_TYPES: readonly BodyType[] = [
  "coupe",
  "sedan",
  "hatchback",
  "convertible",
  "roadster",
  "suv",
  "offroad",
  "wagon",
  "van",
  "minivan",
  "pickup",
  "race-car",
];
export const TAGS: readonly CarTag[] = [
  "sports",
  "supercar",
  "hypercar",
  "hot-hatch",
  "luxury",
  "classic",
  "electric",
  "racing",
  "everyday",
  "rare",
  "concept",
];

const isString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isLocalized = (v: unknown): v is Localized => isRecord(v) && isString(v.fr) && isString(v.en);
const isYear = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1880 && v <= 2100;
const isHttps = (v: unknown): v is string => isString(v) && /^https:\/\//.test(v);

function imageProblem(value: unknown): string | null {
  if (!isRecord(value)) return "image missing";
  if (!isHttps(value.url) || !/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(value.url)) {
    return "image.url must be a Wikimedia Commons URL";
  }
  if (typeof value.width !== "number" || typeof value.height !== "number" || value.width <= 0 || value.height <= 0) {
    return "image size missing";
  }
  if (!isHttps(value.sourcePage) || !isString(value.author) || !isString(value.license)) {
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
  if (value.years !== undefined) {
    const y = value.years;
    if (!isRecord(y) || !isYear(y.from) || !(y.to === null || (isYear(y.to) && y.to >= y.from))) return "invalid years";
  }
  if (!isString(value.country) || !/^[A-Z]{2}$/.test(value.country)) return "invalid country";
  if (!REGIONS.includes(value.region as Region)) return "invalid region";
  if (value.bodyType !== undefined && !BODY_TYPES.includes(value.bodyType as BodyType)) return "invalid bodyType";
  if (!Array.isArray(value.tags) || !value.tags.every((t) => TAGS.includes(t as CarTag))) return "invalid tags";
  if (![1, 2, 3].includes(value.difficulty as number)) return "invalid difficulty";
  if (value.recognition !== undefined && !(typeof value.recognition === "number" && value.recognition >= 0 && value.recognition <= 100)) return "invalid recognition";
  if (!Array.isArray(value.acceptedAnswers) || !value.acceptedAnswers.every(isString)) return "invalid acceptedAnswers";
  if (value.clue !== undefined && !isLocalized(value.clue)) return "clue must be localised";
  if (value.funFact !== undefined && !isLocalized(value.funFact)) return "funFact must be localised";
  return imageProblem(value.image);
}

/**
 * Validates raw catalogue entries. Invalid or duplicate entries are dropped
 * (and reported) rather than breaking the game.
 */
export function parseDataset(raw: unknown): { cars: Car[]; errors: string[] } {
  if (!Array.isArray(raw)) return { cars: [], errors: ["dataset is not an array"] };
  const cars: Car[] = [];
  const errors: string[] = [];
  const ids = new Set<string>();
  raw.forEach((original, index) => {
    // Catalogues built before the three-tier scale used 4 for "expert": that is now hard.
    const entry = isRecord(original) && original.difficulty === 4 ? { ...original, difficulty: 3 } : original;
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

/** "BMW M3 (E46)" */
export function carName(car: Pick<Car, "make" | "model" | "generation">): string {
  return car.generation ? `${car.make} ${car.model} (${car.generation})` : `${car.make} ${car.model}`;
}

export type HintKind = "make" | "period" | "body" | "clue";

/**
 * Hints this car can give: only what its data actually supports, in reveal order.
 * In a brand challenge the make is already known, so that hint is skipped.
 */
export function hintKinds(car: Pick<Car, "years" | "bodyType" | "clue">, { makeKnown = false }: { makeKnown?: boolean } = {}): HintKind[] {
  const kinds: HintKind[] = makeKnown ? [] : ["make"];
  if (car.years) kinds.push("period");
  if (car.bodyType) kinds.push("body");
  if (car.clue) kinds.push("clue");
  return kinds;
}

/** The progressive hints, in the player's language. */
export function hintsFor(
  car: Car,
  t: Messages,
  locale: Locale,
  options: { makeKnown?: boolean } = {},
): { kind: HintKind; text: string }[] {
  return hintKinds(car, options).map((kind) => {
    switch (kind) {
      case "make":
        return { kind, text: t.game.hintMake(car.make) };
      case "period":
        return { kind, text: t.game.hintPeriod(car.years!.from, car.years!.to) };
      case "body":
        return { kind, text: t.game.hintBody(t.bodyTypes[car.bodyType!]) };
      case "clue":
        return { kind, text: car.clue![locale] };
    }
  });
}

/** "1993 – 1998", "1993 –", or null when the source gives no years. */
export function formatYears(car: Pick<Car, "years">): string | null {
  if (!car.years) return null;
  const { from, to } = car.years;
  return to === null ? `${from} –` : from === to ? String(from) : `${from} – ${to}`;
}

const THUMB_STEP = /\/(\d+)px-([^/]+)$/;

/** A Wikimedia thumbnail of the same file at another standard width, when the URL is a thumbnail. */
export function thumbnailUrl(image: Pick<CarImage, "url">, width: 330 | 500 | 960 | 1280): string {
  return THUMB_STEP.test(image.url) && image.url.includes("/thumb/") ? image.url.replace(THUMB_STEP, `/${width}px-$2`) : image.url;
}

/** Responsive candidates for <img srcset>, using Wikimedia's standard thumbnail widths. */
export function imageSrcSet(image: Pick<CarImage, "url">): string | undefined {
  if (!image.url.includes("/thumb/") || !THUMB_STEP.test(image.url)) return undefined;
  return [500, 960, 1280].map((w) => `${thumbnailUrl(image, w as 500 | 960 | 1280)} ${w}w`).join(", ");
}

/** Credit line required by the licence ("Author, CC BY-SA 4.0, via Wikimedia Commons"). */
export function attribution(image: Pick<CarImage, "author" | "license">): string {
  return `${image.author}, ${image.license}, via Wikimedia Commons`;
}
