export type Locale = "fr" | "en";

export type Localized = Record<Locale, string>;

/** Broad origin of the brand; drives the regional categories. */
export type Region = "europe" | "japan" | "usa" | "korea" | "china" | "other";

export type BodyType =
  | "coupe"
  | "sedan"
  | "hatchback"
  | "convertible"
  | "roadster"
  | "suv"
  | "offroad"
  | "wagon"
  | "van"
  | "minivan"
  | "pickup"
  | "race-car";

/** Editorial or derived tags; each maps to a category when enough cars carry it. */
export type CarTag =
  | "sports"
  | "supercar"
  | "hypercar"
  | "hot-hatch"
  | "luxury"
  | "classic"
  | "electric"
  | "racing"
  | "everyday"
  | "rare"
  | "concept";

/**
 * 1 easy (iconic), 2 medium (common, recognisable), 3 hard (less common, similar
 * generations), 4 expert (rare, obscure, special editions). See lib/game/difficulty.ts.
 */
export type Difficulty = 1 | 2 | 3 | 4;

export interface CarImage {
  /** Remote image URL (Wikimedia Commons thumbnail); never stored locally. */
  url: string;
  /** Intrinsic size of the original file, used for the aspect ratio. */
  width: number;
  height: number;
  /** CSS object-position, for photos whose subject is off-centre. */
  position?: string;
  /** Page where the image and its license can be verified. */
  sourcePage: string;
  author: string;
  /** License short name, e.g. "CC BY-SA 4.0" or "Public domain". */
  license: string;
  licenseUrl: string | null;
}

export interface Car {
  id: string;
  make: string;
  model: string;
  generation?: string;
  /** Only present when the source states it; never guessed. */
  years?: { from: number; to: number | null };
  /** ISO 3166-1 alpha-2 country of the brand. */
  country: string;
  region: Region;
  bodyType?: BodyType;
  tags: CarTag[];
  difficulty: Difficulty;
  /** Extra accepted spellings; "make model" and "make model generation" are always accepted. */
  acceptedAnswers: string[];
  /** A distinctive clue (curated, or derived from structured data such as the designer). */
  clue?: Localized;
  funFact?: Localized;
  /** Wikidata item the entry comes from. */
  wikidata?: string;
  /** Wikipedia articles, for "learn more". */
  links?: Partial<Localized>;
  image: CarImage;
}
