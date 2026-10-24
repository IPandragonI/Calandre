import type { Car } from "@/types/car";

/**
 * Deterministic answer matching.
 *
 * 1. Both the player's input and every accepted alias are normalised
 *    (case, accents, punctuation, hyphens, spacing, brand nicknames, leading articles).
 * 2. A match is exact on the token set ("911 porsche" = "porsche 911") or on the
 *    compact form ("rx7" = "rx-7" = "rx 7").
 * 3. Typos are tolerated only inside long alphabetic tokens and never in tokens holding
 *    digits, so "Porsche 912" or "BMW M5" can never pass for "Porsche 911" or "BMW M3".
 * 4. Near misses come back as "close" (no attempt consumed) instead of being accepted.
 */

export type CloseReason = "spelling" | "missing-make" | "make-only" | "extra-details";

export type AnswerVerdict =
  | { kind: "correct"; typoTolerated: boolean; precise: boolean }
  | { kind: "close"; reason: CloseReason }
  | { kind: "wrong" }
  | { kind: "empty" };

/** Brand nicknames, applied at the start of an answer only. */
const MAKE_NICKNAMES: [RegExp, string][] = [
  [/^(?:mercedes(?: benz)?|merco|merc|benz)\b/, "mercedes benz"],
  [/^vw\b/, "volkswagen"],
  [/^chevy\b/, "chevrolet"],
  [/^alfa(?: romeo)?\b/, "alfa romeo"],
  [/^lambo\b/, "lamborghini"],
  [/^aston(?: martin)?\b/, "aston martin"],
];

const LEADING_ARTICLES = /^(?:(?:le|la|les|l|un|une|the|a|an)\s+)+/;

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
  return text.replace(/\s+/g, " ").trim();
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

type ValidatableCar = Pick<Car, "id" | "make" | "model" | "generation" | "acceptedAnswers">;

/** Every accepted answer for a car, normalised. */
export function acceptedAnswersFor(car: Omit<ValidatableCar, "id">): AcceptedAnswer[] {
  const generationTokens = car.generation ? tokens(normalizeAnswer(car.generation)) : [];
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
  return out;
}

/**
 * Checks a player's answer against the expected car.
 * `otherCars` (the rest of the dataset) prevents typo tolerance from ever
 * accepting the exact name of a different car.
 */
export function validateAnswer(input: string, car: ValidatableCar, otherCars: readonly ValidatableCar[] = []): AnswerVerdict {
  const answer = normalizeAnswer(input);
  if (!answer) return { kind: "empty" };

  const accepted = acceptedAnswersFor(car);

  const exact = accepted.find((a) => sameAnswer(answer, a.normalized));
  if (exact) return { kind: "correct", typoTolerated: false, precise: exact.precise };

  const namesAnotherCar = otherCars.some(
    (other) => other.id !== car.id && acceptedAnswersFor(other).some((a) => sameAnswer(answer, a.normalized)),
  );
  if (namesAnotherCar) return { kind: "wrong" };

  const typo = accepted.find((a) => typoDistance(answer, a.normalized) !== null);
  if (typo) return { kind: "correct", typoTolerated: true, precise: typo.precise };

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
