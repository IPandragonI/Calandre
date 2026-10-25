// Pure classification rules for the catalogue builder (unit-tested in rules.test.ts).
import { normalizeAnswer } from "../../src/lib/game/answer-validation";
import type { BodyType, CarTag, Region } from "../../src/types/car";

// ── Names ────────────────────────────────────────────────────────────────────

/** Corporate suffixes stripped from brand labels ("DS Automobiles" → "DS"). */
const CORPORATE_SUFFIX =
  /\s+(automobiles?|automobili|automóviles|automobile|motors?|motor company|motor corporation|motor co\.?|cars|car company|ag|gmbh|s\.?p\.?a\.?|s\.?a\.?|ltd\.?|limited|inc\.?|corporation|corp\.?|company|group|holdings?)$/i;

export function cleanMake(label: string): string {
  let out = label.trim();
  for (let i = 0; i < 3 && CORPORATE_SUFFIX.test(out); i++) out = out.replace(CORPORATE_SUFFIX, "").trim();
  return out;
}

/** `text` without `prefix` when it starts with it (accent/case-insensitive, whole words), else null. */
export function stripPrefix(text: string, prefix: string): string | null {
  const t = normalizeAnswer(text).split(" ");
  const p = normalizeAnswer(prefix).split(" ");
  if (p.length === 0 || p.length > t.length || !p.every((w, i) => t[i] === w)) return null;
  // Rebuild the remainder from the original text, keeping its spelling and punctuation.
  // Take the longest run of words that normalises to the prefix: nicknames expand ("Aston"
  // alone reads as "aston martin"), so the shortest match would leave "Martin" behind.
  const words = text.trim().split(/\s+/);
  const target = p.join(" ");
  let end: number | null = null;
  for (let index = 1; index <= words.length; index++) {
    const head = normalizeAnswer(words.slice(0, index).join(" "));
    if (head === target) end = index;
    else if (head.split(" ").length > p.length) break;
  }
  return end === null ? null : words.slice(end).join(" ");
}

const TRAILING_GENERATION = /^(.*\S)\s+((?:mk|mark)\s*[ivx\d]+|[IVX]{1,4}|\d{1,2}(?:st|nd|rd|th) generation)$/i;

export interface ParsedName {
  make: string;
  model: string;
  generation?: string;
}

/**
 * Splits an item label into make / model / generation.
 * "Toyota Supra (A80)" → Toyota · Supra · A80; "Porsche 993" (series "Porsche 911") → Porsche · 911 · 993.
 * Returns null when the label cannot be tied to the brand (sent to review).
 */
export function parseName(label: string, makes: string[], seriesLabel: string | null): ParsedName | null {
  for (const make of makes.filter(Boolean)) {
    const rest = stripPrefix(label, make);
    if (rest === null || rest.trim() === "") continue;
    const clean = (s: string) => s.replace(/^\(|\)$/g, "").replace(/\s+/g, " ").trim();

    const seriesModel = seriesLabel ? (stripPrefix(seriesLabel, make) ?? null) : null;
    if (seriesModel) {
      const afterModel = stripPrefix(rest, seriesModel);
      const generation = clean(afterModel ?? (normalizeAnswer(rest) === normalizeAnswer(seriesModel) ? "" : rest));
      // A "series" that is really a product line (EQ → EQV, bZ → bZ3X): the item is its own model.
      const lineWord = normalizeAnswer(seriesModel).split(" ")[0];
      const genCompact = normalizeAnswer(generation).replace(/ /g, "");
      if (generation && genCompact.length > lineWord.length && genCompact.startsWith(lineWord)) return { make, model: clean(rest) };
      return generation ? { make, model: clean(seriesModel), generation } : { make, model: clean(seriesModel) };
    }
    const paren = rest.match(/^(.*\S)\s*\(([^)]+)\)$/);
    if (paren) return { make, model: clean(paren[1]), generation: clean(paren[2]) };
    const trailing = rest.match(TRAILING_GENERATION);
    if (trailing) return { make, model: clean(trailing[1]), generation: clean(trailing[2]) };
    return { make, model: clean(rest) };
  }
  return null;
}

// ── Photographs ─────────────────────────────────────────────────────────────

/** Words in a file name that betray a detail shot, a model, a drawing… rather than the car. */
const EXCLUDED_FILE_WORDS = new Set([
  "interior", "interieur", "innenraum", "innen", "cockpit", "dashboard", "armaturenbrett", "instrument", "instruments",
  "engine", "motor", "moteur", "motorraum", "enginebay", "logo", "emblem", "badge", "embleme", "wheel", "wheels", "rim",
  "felge", "seat", "seats", "trunk", "kofferraum", "boot", "steering", "lenkrad", "tacho", "speedometer", "detail",
  "details", "key", "gear", "shifter", "drawing", "sketch", "blueprint", "patent", "brochure", "advert", "advertisement",
  "poster", "scale", "diecast", "toy", "lego", "modell", "miniature", "maquette", "crash", "wreck", "burnt",
  "chassis", "frame", "cutaway", "cutout", "schnitt", "skeleton", "taillight", "headlight", "lamp", "grille",
]);

export function fileExclusion(title: string): string | null {
  const words = normalizeAnswer(title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")).split(" ");
  const hit = words.find((w) => EXCLUDED_FILE_WORDS.has(w));
  return hit ?? null;
}

/** Generic words that say nothing about which model is pictured. */
const GENERIC_WORDS = new Set([
  "the", "de", "la", "le", "der", "die", "das", "series", "serie", "class", "classe", "klasse", "coupe", "sedan",
  "berline", "cabriolet", "convertible", "roadster", "wagon", "estate", "hatchback", "car", "cars", "auto", "concept",
  "sport", "sports", "gt", "new", "type", "model", "edition", "line",
]);

/**
 * True when the file name names the model: at least one distinctive model or generation
 * token appears in it. A mismatch doesn't prove the photo is wrong, but it is not
 * trusted automatically either (sent to review).
 */
export function fileNamesModel(title: string, name: ParsedName): boolean {
  const fileWords = new Set(normalizeAnswer(title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")).split(" "));
  const fileCompact = [...fileWords].join("");
  const tokens = normalizeAnswer(`${name.model} ${name.generation ?? ""}`)
    .split(" ")
    .filter((t) => t && !GENERIC_WORDS.has(t) && (t.length >= 2 || /\d/.test(t)));
  if (tokens.length === 0) return false;
  return tokens.some((t) => fileWords.has(t) || (t.length >= 3 && fileCompact.includes(t)));
}

export function photoProblem(file: { width: number; height: number; mime: string; licenseAllowed: boolean; license: string }): string | null {
  if (!file.licenseAllowed) return `license not allowed (${file.license})`;
  if (!/^image\/(jpeg|png|webp)$/.test(file.mime)) return `unsupported format (${file.mime})`;
  if (file.width < 1000 || file.height < 560) return `too small (${file.width}×${file.height})`;
  const ratio = file.width / file.height;
  if (ratio < 1.15 || ratio > 2.6) return `unsuitable framing (ratio ${ratio.toFixed(2)})`;
  return null;
}

// ── Classification ───────────────────────────────────────────────────────────

const EUROPE = new Set(
  "AT BE BG CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MT NL NO PL PT RO RS RU SE SI SK UA BY".split(" "),
);

export function regionOf(country: string): Region {
  if (EUROPE.has(country)) return "europe";
  if (country === "JP") return "japan";
  if (country === "US") return "usa";
  if (country === "KR") return "korea";
  if (country === "CN") return "china";
  return "other";
}

export interface ClassInfo {
  bodyType?: BodyType;
  tags?: CarTag[];
  /** Not a car the game should show (truck, bus, single-seater…). */
  exclude?: boolean;
}

const EVERYDAY: ClassInfo = { tags: ["everyday"] };
const SUV: ClassInfo = { bodyType: "suv" };
const LUXURY: ClassInfo = { tags: ["luxury"] };
const ELECTRIC: ClassInfo = { tags: ["electric"] };
const MINIVAN: ClassInfo = { bodyType: "minivan", tags: ["everyday"] };
const RACING: ClassInfo = { bodyType: "race-car", tags: ["racing"] };
const EXCLUDE: ClassInfo = { exclude: true };

/**
 * Wikidata classes (P31/P279 English labels, lower case) → body type / tags, from the
 * classes actually found among candidates. Unknown classes are simply ignored.
 */
export const CLASS_RULES: Record<string, ClassInfo> = {
  // Body styles
  "sport utility vehicle": SUV,
  crossover: SUV,
  "mini suv": SUV,
  "subcompact crossover suv": SUV,
  "compact sport utility vehicle": SUV,
  "compact crossover suv": SUV,
  "coupe suv": SUV,
  "off-road vehicle": { bodyType: "offroad" },
  "utility vehicle": { bodyType: "offroad" },
  "pickup truck": { bodyType: "pickup" },
  "coupé utility": { bodyType: "pickup" },
  van: { bodyType: "van" },
  microbus: { bodyType: "van" },
  minibus: { bodyType: "van" },
  minivan: MINIVAN,
  "mini mpv": MINIVAN,
  "compact mpv": MINIVAN,
  microvan: MINIVAN,
  "leisure activity vehicle": MINIVAN,
  sedan: { bodyType: "sedan" },
  "sports sedan": { bodyType: "sedan", tags: ["sports"] },
  hatchback: { bodyType: "hatchback" },
  "combi coupé": { bodyType: "hatchback" },
  "hot hatch": { bodyType: "hatchback", tags: ["hot-hatch"] },
  coupe: { bodyType: "coupe" },
  "2+2": { bodyType: "coupe" },
  fastback: { bodyType: "coupe" },
  roadster: { bodyType: "roadster", tags: ["sports"] },
  convertible: { bodyType: "convertible" },
  "retractable hardtop": { bodyType: "convertible" },
  "retractable hardtop convertibles": { bodyType: "convertible" },
  "station wagon": { bodyType: "wagon" },
  limousine: { bodyType: "sedan", tags: ["luxury"] },
  // Segments and characters
  "sports car": { tags: ["sports"] },
  "grand tourer": { tags: ["sports"] },
  "sport compact": { tags: ["sports"] },
  "performance car": { tags: ["sports"] },
  "muscle car": { bodyType: "coupe", tags: ["sports"] },
  "pony car": { bodyType: "coupe", tags: ["sports"] },
  supercar: { tags: ["supercar"] },
  hypercar: { tags: ["hypercar"] },
  "compact car": EVERYDAY,
  "family car": EVERYDAY,
  supermini: EVERYDAY,
  "subcompact car": EVERYDAY,
  "city car": EVERYDAY,
  "a-segment": EVERYDAY,
  "b-segment": EVERYDAY,
  "c-segment": EVERYDAY,
  "kei car": EVERYDAY,
  microcar: EVERYDAY,
  "economy car": EVERYDAY,
  "mid-size car": EVERYDAY,
  "low cost green car": EVERYDAY,
  "light car of south korea": EVERYDAY,
  "executive car": LUXURY,
  "compact executive car": LUXURY,
  "e-segment": LUXURY,
  "luxury vehicle": LUXURY,
  "personal luxury car": LUXURY,
  "official state car": LUXURY,
  "electric car": ELECTRIC,
  "battery electric vehicle": ELECTRIC,
  "electric vehicle": ELECTRIC,
  "fuel cell hybrid electric vehicle": ELECTRIC,
  "concept car": { tags: ["concept"] },
  prototype: { tags: ["concept"] },
  "race car prototype": RACING,
  "racing automobile model": RACING,
  "racing automobile": RACING,
  "group rally3": RACING,
  // Not what the game is about
  truck: EXCLUDE,
  "truck model": EXCLUDE,
  "tactical truck": EXCLUDE,
  "kei truck": EXCLUDE,
  "commercial vehicle": EXCLUDE,
  tractor: EXCLUDE,
  "battery electric bus": EXCLUDE,
  "combat vehicle model": EXCLUDE,
  "armored car": EXCLUDE,
  "military vehicle model": EXCLUDE,
  "amphibious vehicle": EXCLUDE,
  "flying car": EXCLUDE,
  "formula one car": EXCLUDE,
  "dune buggy": EXCLUDE,
  "wikimedia disambiguation page": EXCLUDE,
  brand: EXCLUDE,
  "car brand": EXCLUDE,
  "automobile platform": EXCLUDE,
  business: EXCLUDE,
};

export function classify(classLabels: string[]): { bodyType?: BodyType; tags: CarTag[]; excludedBy?: string } {
  const tags = new Set<CarTag>();
  let bodyType: BodyType | undefined;
  for (const raw of classLabels) {
    const rule = CLASS_RULES[raw.toLowerCase()];
    if (!rule) continue;
    if (rule.exclude) return { tags: [], excludedBy: raw };
    rule.tags?.forEach((t) => tags.add(t));
    bodyType ??= rule.bodyType;
  }
  if (tags.has("hypercar")) tags.add("supercar");
  if (tags.has("hot-hatch")) tags.add("sports");
  if (tags.has("concept")) tags.add("rare");
  return { bodyType, tags: [...tags] };
}
