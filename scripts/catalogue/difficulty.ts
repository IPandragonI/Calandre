// Difficulty phase: a recognisability score (0–100) for every car, then a tier.
//
// The score measures how likely a broad audience is to recognise the *model*, not how old
// or exotic it is. Signals, all measured or stated, never estimated:
//   • popularity — Wikipedia page views (fr + en, 12 months) of the car's own article, or of
//     its model family's article for a generation or variant (a Clio IV is recognised as a
//     Clio). Older generations borrow less from their family: they look nothing like the
//     current car. Weight 65 %.
//   • notability — number of Wikipedia editions describing the car (or its family). 25 %.
//   • brand — page views of the brand's article: a small nudge only, a famous badge does not
//     make every model easy. 10 %.
//   • adjustments — production volume where Wikidata states it (mass-produced +, limited −),
//     pre-war and early post-war cars −, concept and race cars −.
// Curated classifications (data/catalogue/recognition.json) take precedence for important
// models. Thresholds: easy ≥ 58, medium ≥ 36, hard below.
import type { Car, CarTag, Difficulty } from "../../src/types/car";
import { claimIds, type Entity } from "../lib/wikidata";
import { statedCount } from "./details";
import { articleOf, type Wiki } from "./popularity";

export interface Signals {
  /** Views of the car's own articles, fr + en. */
  views: number;
  /** Views of its model family's articles (0 for a standalone model). */
  familyViews: number;
  brandViews: number;
  /** Wikipedia editions describing the car, and its family. */
  sitelinks: number;
  familySitelinks: number;
  /** Units built, when Wikidata states it. */
  produced: number | null;
  /** First production year: Wikidata, else the first year in the Wikipedia intro. */
  startYear: number | null;
  relation: "model" | "generation" | "variant";
  tags: readonly CarTag[];
}

export interface Recognition {
  score: number;
  difficulty: Difficulty;
  /** Why: rounded contributions, for the build report. */
  why: string;
}

export interface CuratedRecognition {
  models?: Partial<Record<"easy" | "medium" | "hard", string[]>>;
  cars?: Record<string, Difficulty>;
}

export const THRESHOLDS = { easy: 58, medium: 36 } as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0 at `low`, 1 at `high`, on a log scale. */
const logScale = (value: number, low: number, high: number) => clamp01((Math.log10(1 + value) - Math.log10(low)) / (Math.log10(high) - Math.log10(low)));

/** How much of the family's fame a car inherits. */
export function familyWeight(relation: Signals["relation"], startYear: number | null): number {
  if (relation === "model") return 0;
  if (relation === "variant") return 0.3;
  return startYear !== null && startYear < 1990 ? 0.35 : 0.8;
}

export function recognitionScore(s: Signals): { score: number; why: string } {
  const w = familyWeight(s.relation, s.startYear);
  const popularity = logScale(Math.max(s.views, s.familyViews * w), 3_000, 400_000);
  const notability = logScale(Math.max(s.sitelinks, s.familySitelinks * w), 5, 80);
  const brand = logScale(s.brandViews, 30_000, 1_500_000);
  const parts: [string, number][] = [
    ["popularity", 65 * popularity],
    ["notability", 25 * notability],
    ["brand", 10 * brand],
  ];
  if (s.produced !== null) parts.push(["production", s.produced >= 1_000_000 ? 6 : s.produced >= 100_000 ? 3 : s.produced < 1_000 ? -8 : 0]);
  if (s.startYear !== null) parts.push(["era", s.startYear < 1940 ? -12 : s.startYear < 1960 ? -6 : 0]);
  if (s.tags.includes("concept")) parts.push(["concept", -15]);
  else if (s.tags.includes("racing")) parts.push(["racing", -8]);
  const score = Math.round(Math.min(100, Math.max(0, parts.reduce((sum, [, v]) => sum + v, 0))));
  const why = parts
    .filter(([, v]) => Math.round(v) !== 0)
    .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${Math.round(v)}`)
    .join(", ");
  return { score, why };
}

export function tierFor(score: number, tags: readonly CarTag[]): Difficulty {
  let tier: Difficulty = score >= THRESHOLDS.easy ? 1 : score >= THRESHOLDS.medium ? 2 : 3;
  // Concepts and prototypes are never easy guesses; race cars at least need some knowledge.
  if (tags.includes("concept")) tier = 3;
  else if (tags.includes("racing") && tier < 2) tier = 2;
  return tier;
}

const TIER: Record<"easy" | "medium" | "hard", Difficulty> = { easy: 1, medium: 2, hard: 3 };
const familyName = (car: Pick<Car, "make" | "model">) => `${car.make} ${car.model}`.toLowerCase();

/** Curated tier for a car, if any: per car id first, then per model family. */
export function curatedTier(car: Pick<Car, "id" | "make" | "model" | "generation">, startYear: number | null, curated: CuratedRecognition): Difficulty | null {
  const byId = curated.cars?.[car.id];
  if (byId) return byId;
  for (const [level, names] of Object.entries(curated.models ?? {}) as ["easy" | "medium" | "hard", string[]][]) {
    if (!names.some((n) => n.toLowerCase() === familyName(car))) continue;
    // A familiar model's older generations are a step harder: they look nothing like today's car.
    if (level === "easy" && car.generation && startYear !== null && startYear < 1990) return 2;
    return TIER[level];
  }
  return null;
}

export function classifyCar(car: Pick<Car, "id" | "make" | "model" | "generation">, signals: Signals, curated: CuratedRecognition): Recognition {
  const { score, why } = recognitionScore(signals);
  const manual = curatedTier(car, signals.startYear, curated);
  const computed = tierFor(score, signals.tags);
  // A curated "easy" model can still be made harder by a computed tier (a generation that is
  // obscure in its own right), never the other way round.
  const difficulty = manual === null ? computed : manual === 1 ? computed === 3 ? 2 : 1 : manual;
  return { score, difficulty, why: manual === null ? why : `${why}; curated: ${manual}` };
}

/** First plausible production year in a text (the opening of a Wikipedia article). */
export function firstYear(text: string | undefined): number | null {
  const m = text?.match(/\b(18[89]\d|19\d\d|20[0-2]\d)\b/);
  return m ? Number(m[1]) : null;
}

// ── Signals from the cached Wikidata entities, page views and Wikipedia intros ──────────

export interface SignalSources {
  entities: Map<string, Entity>;
  /** Wikidata item behind each car (curated cars borrow the matching item). */
  itemOf: (car: Car) => string | undefined;
  views: (wiki: Wiki, title: string) => number;
  /** Wikipedia editions describing an item and its family, from the candidate query. */
  sitelinks: (item: string | undefined) => { item: number; series: number } | undefined;
  /** Intro extracts by article title. */
  extracts: Record<Wiki, Record<string, string>>;
}

const WIKIS: Wiki[] = ["fr", "en"];

function articlesOf(entity: Entity | undefined): [Wiki, string][] {
  return WIKIS.flatMap((wiki) => {
    const title = entity?.sitelinks?.[`${wiki}wiki`]?.title;
    return title ? [[wiki, title] as [Wiki, string]] : [];
  });
}

/** Every Wikipedia article whose page views the scores need. */
export function articlesToMeasure(cars: readonly Car[], src: Pick<SignalSources, "entities" | "itemOf">): [Wiki, string][] {
  const out: [Wiki, string][] = [];
  for (const car of cars) {
    const entity = src.entities.get(src.itemOf(car) ?? "");
    for (const wiki of WIKIS) {
      const article = articleOf(car.links?.[wiki]);
      if (article) out.push(article);
    }
    for (const id of [...claimIds(entity, "P179"), ...claimIds(entity, "P1716"), ...claimIds(entity, "P176")]) out.push(...articlesOf(src.entities.get(id)));
  }
  return out;
}

export function gatherSignals(cars: readonly Car[], src: SignalSources): Map<string, Signals> {
  const total = (articles: [Wiki, string][]) => articles.reduce((sum, [wiki, title]) => sum + src.views(wiki, title), 0);
  const entityOf = (car: Car) => src.entities.get(src.itemOf(car) ?? "");
  // A generation without its own "part of the series" borrows the family of a sibling.
  const familyByModel = new Map<string, string>();
  for (const car of cars) {
    const series = claimIds(entityOf(car), "P179")[0];
    if (series && !familyByModel.has(familyName(car))) familyByModel.set(familyName(car), series);
  }

  const out = new Map<string, Signals>();
  for (const car of cars) {
    const entity = entityOf(car);
    const own = WIKIS.map((wiki) => articleOf(car.links?.[wiki])).filter((a): a is [Wiki, string] => a !== null);
    const familyId = claimIds(entity, "P179")[0] ?? (car.generation ? familyByModel.get(familyName(car)) : undefined);
    const family = familyId ? src.entities.get(familyId) : undefined;
    const brand = src.entities.get(claimIds(entity, "P1716")[0] ?? claimIds(entity, "P176")[0] ?? "");
    const counts = src.sitelinks(src.itemOf(car));
    const intro = own.map(([wiki, title]) => src.extracts[wiki][title]).find(Boolean);
    out.set(car.id, {
      views: total(own),
      familyViews: total(articlesOf(family)),
      brandViews: total(articlesOf(brand)),
      sitelinks: counts?.item ?? own.length,
      familySitelinks: counts?.series ?? 0,
      produced: statedCount(entity, "P1092"),
      startYear: car.years?.from ?? firstYear(intro),
      relation: car.generation ? "generation" : family ? "variant" : "model",
      tags: car.tags,
    });
  }
  return out;
}
