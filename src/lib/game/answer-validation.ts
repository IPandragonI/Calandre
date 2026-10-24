import type { Car } from "@/types/car";

/**
 * Deterministic answer matching.
 *
 * 1. Both the player's input and every accepted alias are normalised (case, accents,
 *    punctuation, hyphens, spacing, brand nicknames, leading articles, generation
 *    spellings "Mk4" = "Mark IV" = "IV" = "4", "Série 3" = "3 Series").
 * 2. A match is exact on the token set ("911 porsche" = "porsche 911") or on the
 *    compact form ("rx7" = "rx-7" = "rx 7").
 * 3. Typos are tolerated only inside long alphabetic tokens and never in tokens holding
 *    digits, so "Porsche 912" or "BMW M5" can never pass for "Porsche 911" or "BMW M3".
 * 4. Near misses come back as "close" (no attempt consumed) instead of being accepted.
 */

export type CloseReason = "spelling" | "missing-make" | "make-only" | "extra-details" | "generation";

export type AnswerVerdict =
  | { kind: "correct"; typoTolerated: boolean; precise: boolean }
  | { kind: "close"; reason: CloseReason }
  /** `sameModel`: the player named another generation of the right model. */
  | { kind: "wrong"; sameModel?: boolean }
  | { kind: "empty" };

/** Brand nicknames, applied at the start of an answer only. */
const MAKE_NICKNAMES: [RegExp, string][] = [
  [/^(?:mercedes(?: benz)?|merco|merc|benz)\b/, "mercedes benz"],
  [/^vw\b/, "volkswagen"],
  [/^chevy\b/, "chevrolet"],
  [/^alfa(?: romeo)?\b/, "alfa romeo"],
  [/^lambo\b/, "lamborghini"],
  [/^aston(?: martin)?\b/, "aston martin"],
  [/^(?:bimmer|beemer|beamer)\b/, "bmw"],
  [/^rolls(?: royce)?\b/, "rolls royce"],
];

const LEADING_ARTICLES = /^(?:(?:le|la|les|l|un|une|the|a|an)\s+)+/;

const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };
const SYNONYMS: Record<string, string> = { serie: "series", classe: "class", klasse: "class", mark: "mk" };
/** Ordinals in English and French ("fourth", "4th", "quatrième", "4e") → "4". */
const ORDINALS: Record<string, string> = {
  first: "1", second: "2", third: "3", fourth: "4", fifth: "5", sixth: "6", seventh: "7", eighth: "8", ninth: "9", tenth: "10",
  premier: "1", premiere: "1", deuxieme: "2", seconde: "2", troisieme: "3", quatrieme: "4", cinquieme: "5", sixieme: "6",
  septieme: "7", huitieme: "8", neuvieme: "9", dixieme: "10",
};
/** Words that only say "this is a generation" ("4th generation" = "4"). */
const GENERATION_WORDS = new Set(["generation", "gen"]);

/** Generation spellings: "mk 4" / "mk4" / "mkiv" / "iv" / "4th generation" → "4" (never the first word, the make). */
function canonicalTokens(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && GENERATION_WORDS.has(words[i])) continue;
    const ordinal = words[i].match(/^(\d{1,2})(?:st|nd|rd|th|e|er|re|eme|ere)$/);
    let w = SYNONYMS[words[i]] ?? (i > 0 ? (ORDINALS[words[i]] ?? ordinal?.[1]) : undefined) ?? words[i];
    if (i > 0) {
      const mk = w.match(/^mk([ivx]+|\d+)$/);
      if (mk) w = ROMAN[mk[1]] ?? mk[1];
      else if (w === "mk" && i + 1 < words.length && /^([ivx]+|\d+)$/.test(words[i + 1])) continue;
      else w = ROMAN[w] ?? w;
    }
    out.push(w);
  }
  return out;
}

export function normalizeAnswer(input: string): string {
  let text = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  text = text.replace(LEADING_ARTICLES, "");
  for (const [pattern, canonical] of MAKE_NICKNAMES) {
    if (pattern.test(text)) {
      text = text.replace(pattern, canonical);
      break;
    }
  }
  return canonicalTokens(text.split(/\s+/).filter(Boolean)).join(" ");
}

function tokens(normalized: string): string[] {
  return normalized ? normalized.split(" ") : [];
}

function tokenKey(normalized: string): string {
  return tokens(normalized).sort().join(" ");
}

function compactKey(normalized: string): string {
  return normalized.replace(/ /g, "");
}

function sameAnswer(a: string, b: string): boolean {
  return tokenKey(a) === tokenKey(b) || compactKey(a) === compactKey(b);
}

/** Optimal string alignment distance (Damerau–Levenshtein with adjacent transpositions). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Typos allowed in one token: none for short or numeric tokens. */
function typoBudget(token: string): number {
  if (/\d/.test(token) || token.length < 5) return 0;
  return token.length >= 9 ? 2 : 1;
}

/**
 * Compares token by token, in order. Returns the number of typos used when every token
 * is within its budget (plus `slack`), or null when the answers differ by more than typos.
 */
function typoDistance(input: string, alias: string, slack = 0): number | null {
  const a = tokens(input);
  const b = tokens(alias);
  if (a.length !== b.length) return null;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const budget = typoBudget(b[i]);
    if (budget === 0) return null;
    const distance = editDistance(a[i], b[i]);
    if (distance > budget + slack) return null;
    total += distance;
  }
  return total;
}

export interface AcceptedAnswer {
  normalized: string;
  /** True when the alias names the generation/variant (e.g. "BMW M3 E46"). */
  precise: boolean;
}

export type ValidatableCar = Pick<Car, "id" | "make" | "model" | "generation" | "acceptedAnswers">;

const acceptedCache = new WeakMap<object, AcceptedAnswer[]>();

/** Every accepted answer for a car, normalised. */
export function acceptedAnswersFor(car: Omit<ValidatableCar, "id">): AcceptedAnswer[] {
  const cached = acceptedCache.get(car);
  if (cached) return cached;
  // Normalised after a placeholder word, as inside a full answer ("Mk4" → "4").
  const generationTokens = car.generation ? tokens(normalizeAnswer(`x ${car.generation}`)).slice(1) : [];
  const isPrecise = (normalized: string) =>
    generationTokens.length > 0 && generationTokens.every((t) => tokens(normalized).includes(t));

  const raw = [`${car.make} ${car.model}`, ...car.acceptedAnswers];
  if (car.generation) raw.push(`${car.make} ${car.model} ${car.generation}`);

  const seen = new Set<string>();
  const out: AcceptedAnswer[] = [];
  for (const answer of raw) {
    const normalized = normalizeAnswer(answer);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push({ normalized, precise: isPrecise(normalized) });
  }
  acceptedCache.set(car, out);
  return out;
}

/** "make model", normalised: the family a generation belongs to. */
export function modelKey(car: Pick<Car, "make" | "model">): string {
  return tokenKey(normalizeAnswer(`${car.make} ${car.model}`));
}

/** Lookup of every accepted answer in the catalogue, built once per catalogue. */
export interface AnswerIndex {
  owners(normalized: string): readonly ValidatableCar[];
}

export function buildAnswerIndex(cars: readonly ValidatableCar[]): AnswerIndex {
  const byKey = new Map<string, ValidatableCar[]>();
  const add = (key: string, car: ValidatableCar) => {
    const list = byKey.get(key);
    if (!list) byKey.set(key, [car]);
    else if (!list.includes(car)) list.push(car);
  };
  for (const car of cars) {
    for (const { normalized } of acceptedAnswersFor(car)) {
      add(`t:${tokenKey(normalized)}`, car);
      add(`c:${compactKey(normalized)}`, car);
    }
  }
  return {
    owners: (normalized) => {
      const a = byKey.get(`t:${tokenKey(normalized)}`) ?? [];
      const b = byKey.get(`c:${compactKey(normalized)}`) ?? [];
      return b.length === 0 ? a : [...new Set([...a, ...b])];
    },
  };
}

export interface ValidationOptions {
  /** Generation mode: a correct model without the right generation is only "close". */
  requireGeneration?: boolean;
  /**
   * Brand challenge: the make is implied, so "F40" counts as "Ferrari F40". The answer is
   * judged both as typed and with the make prepended, and the better verdict wins.
   */
  impliedMake?: string | null;
}

const VERDICT_RANK: Record<AnswerVerdict["kind"], number> = { correct: 3, close: 2, wrong: 1, empty: 0 };

/**
 * Checks a player's answer against the expected car. `others` (the rest of the
 * catalogue, or its index) prevents typo tolerance from ever accepting the exact
 * name of a different car.
 */
export function validateAnswer(
  input: string,
  car: ValidatableCar,
  others: readonly ValidatableCar[] | AnswerIndex = [],
  { requireGeneration = false, impliedMake = null }: ValidationOptions = {},
): AnswerVerdict {
  const answer = normalizeAnswer(input);
  if (!answer) return { kind: "empty" };

  if (impliedMake) {
    const asTyped = validateAnswer(input, car, others, { requireGeneration });
    const make = normalizeAnswer(impliedMake);
    // Already starts with the make: nothing to add.
    if (answer === make || answer.startsWith(`${make} `)) return asTyped;
    const withMake = validateAnswer(`${impliedMake} ${input}`, car, others, { requireGeneration });
    // "Missing make" makes no sense when the make is implied.
    const usable = (v: AnswerVerdict) => !(v.kind === "close" && v.reason === "missing-make");
    const candidates = [withMake, asTyped].filter(usable);
    return candidates.sort((a, b) => VERDICT_RANK[b.kind] - VERDICT_RANK[a.kind])[0] ?? withMake;
  }

  const accepted = acceptedAnswersFor(car);
  const generationNeeded = requireGeneration && Boolean(car.generation);
  const verdictFor = (match: AcceptedAnswer, typoTolerated: boolean): AnswerVerdict =>
    generationNeeded && !match.precise ? { kind: "close", reason: "generation" } : { kind: "correct", typoTolerated, precise: match.precise };

  const exact = accepted.find((a) => sameAnswer(answer, a.normalized));
  if (exact) return verdictFor(exact, false);

  const index = Array.isArray(others) ? buildAnswerIndex(others as ValidatableCar[]) : (others as AnswerIndex);
  const otherOwners = index.owners(answer).filter((other) => other.id !== car.id);
  if (otherOwners.length > 0) {
    const family = modelKey(car);
    return { kind: "wrong", sameModel: otherOwners.some((other) => modelKey(other) === family) };
  }

  const typo = accepted.find((a) => typoDistance(answer, a.normalized) !== null);
  if (typo) return verdictFor(typo, true);

  if (sameAnswer(answer, normalizeAnswer(car.make))) return { kind: "close", reason: "make-only" };

  // Right model, but the make is missing ("Countach", "M3 E46").
  const withMake = normalizeAnswer(`${car.make} ${answer}`);
  if (accepted.some((a) => sameAnswer(withMake, a.normalized) || typoDistance(withMake, a.normalized) !== null)) {
    return { kind: "close", reason: "missing-make" };
  }

  // Spelling slightly beyond the tolerated budget.
  if (accepted.some((a) => typoDistance(answer, a.normalized, 1) !== null)) {
    return { kind: "close", reason: "spelling" };
  }

  // The correct name plus one or two extra words ("Porsche 911 Turbo" for a Carrera).
  const answerTokens = tokens(answer);
  const containsAccepted = accepted.some((a) => {
    const aliasTokens = tokens(a.normalized);
    const extra = answerTokens.length - aliasTokens.length;
    return extra > 0 && extra <= 2 && aliasTokens.every((t) => answerTokens.includes(t));
  });
  if (containsAccepted) return { kind: "close", reason: "extra-details" };

  return { kind: "wrong" };
}
