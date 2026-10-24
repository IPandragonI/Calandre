export type Locale = "fr" | "en";

export type Localized = Record<Locale, string>;

/** Where the manufacturer comes from; drives the regional categories. */
export type Region = "europe" | "japan" | "usa" | "korea";

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
  | "race-car";

/** Editorial tags; each maps to a category when enough cars carry it. */
export type CarTag = "sports" | "supercar" | "classic" | "electric" | "racing" | "everyday" | "rare";

/** 1 = iconic, 2 = enthusiast, 3 = expert. */
export type Difficulty = 1 | 2 | 3;

export interface CarImage {
  /** Path prefix of the bundled renditions: `${src}-640.webp` and `${src}-1200.webp`. */
  src: string;
  /** Intrinsic size of the 1200px rendition, to reserve layout space. */
  width: number;
  height: number;
  /** CSS object-position, for photos whose subject is off-centre. */
  position?: string;
  /** Descriptive alt text, only exposed once the answer is revealed. */
  alt: Localized;
  sourcePage: string;
  author: string;
  license: string;
  licenseUrl: string | null;
}

export interface Car {
  id: string;
  make: string;
  model: string;
  generation?: string;
  years: { from: number; to: number | null };
  region: Region;
  bodyType: BodyType;
  tags: CarTag[];
  difficulty: Difficulty;
  /** Extra accepted spellings; "make model" and "make model generation" are always accepted. */
  acceptedAnswers: string[];
  /** The fourth, curated hint. */
  clue: Localized;
  funFact: Localized;
  image: CarImage;
}
