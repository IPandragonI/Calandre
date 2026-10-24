import type { Car, Difficulty } from "@/types/car";
import { carInCategory, type CategoryId } from "./categories";
import { nextRandom, shuffle } from "./random";

export const DIFFICULTY_FILTERS = ["mixed", "easy", "hard"] as const;
export type DifficultyFilter = (typeof DIFFICULTY_FILTERS)[number];

type SelectableCar = Pick<Car, "id" | "difficulty" | "region" | "tags">;

function matchesDifficulty(difficulty: Difficulty, filter: DifficultyFilter): boolean {
  if (filter === "easy") return difficulty === 1;
  if (filter === "hard") return difficulty >= 2;
  return true;
}

export interface SelectionOptions {
  category?: CategoryId | null;
  difficulty?: DifficultyFilter;
  /** Recently played cars, used only when there is nothing fresher. */
  avoidIds?: readonly string[];
}

/**
 * Picks `count` distinct cars for a fixed-length game, easiest first.
 * The category is a hard filter; the difficulty filter is topped up with other
 * cars when it matches too few. Returns fewer ids only when the pool is too small.
 */
export function selectQuestions(
  cars: readonly SelectableCar[],
  count: number,
  random: () => number,
  { category = null, difficulty = "mixed", avoidIds = [] }: SelectionOptions = {},
): string[] {
  const pool = category ? cars.filter((car) => carInCategory(car, category)) : [...cars];
  const avoid = new Set(avoidIds);
  // Fresh cars first, recently seen ones only as a fallback; both shuffled.
  const ordered = [
    ...shuffle(pool.filter((c) => !avoid.has(c.id)), random),
    ...shuffle(pool.filter((c) => avoid.has(c.id)), random),
  ];
  const preferred = ordered.filter((c) => matchesDifficulty(c.difficulty, difficulty));
  const rest = ordered.filter((c) => !matchesDifficulty(c.difficulty, difficulty));
  const picked = [...preferred, ...rest].slice(0, Math.max(0, count));
  // Stable sort: a gentle ramp from iconic to expert.
  return picked.sort((a, b) => a.difficulty - b.difficulty).map((c) => c.id);
}

/** Endless mode: the allowed difficulty grows with the number of questions played. */
export function endlessMaxDifficulty(questionIndex: number): Difficulty {
  if (questionIndex < 5) return 1;
  if (questionIndex < 12) return 2;
  return 3;
}

/**
 * Picks the next car for open-ended modes, avoiding repeats until the pool is exhausted.
 * Returns the id and the new random state.
 */
export function pickNextCar(
  cars: readonly SelectableCar[],
  seenIds: readonly string[],
  maxDifficulty: Difficulty,
  randomState: number,
): [id: string | null, nextState: number] {
  if (cars.length === 0) return [null, randomState];
  const seen = new Set(seenIds);
  let pool = cars.filter((c) => !seen.has(c.id) && c.difficulty <= maxDifficulty);
  if (pool.length === 0) pool = cars.filter((c) => !seen.has(c.id));
  if (pool.length === 0) {
    // Everything has been shown: allow repeats, but not the most recent ones.
    const recent = new Set(seenIds.slice(-Math.floor(cars.length / 2)));
    pool = cars.filter((c) => !recent.has(c.id));
  }
  // Lean towards the hardest allowed tier so the difficulty actually ramps up.
  const top = pool.filter((c) => c.difficulty === maxDifficulty);
  let [roll, state] = nextRandom(randomState);
  if (top.length > 0 && roll < 0.6) pool = top;
  [roll, state] = nextRandom(state);
  return [pool[Math.floor(roll * pool.length)].id, state];
}
