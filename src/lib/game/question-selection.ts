import type { Car, Difficulty } from "@/types/car";
import { nextRandom, shuffle } from "./random";

export const DIFFICULTY_FILTERS = ["mixed", "easy", "medium", "hard", "expert"] as const;
export type DifficultyFilter = (typeof DIFFICULTY_FILTERS)[number];

const LEVEL: Record<Exclude<DifficultyFilter, "mixed">, Difficulty> = { easy: 1, medium: 2, hard: 3, expert: 4 };

/** Share of each difficulty in a "mixed" game: mostly recognisable, a few hard ones. */
const MIXED_WEIGHTS: Record<Difficulty, number> = { 1: 0.35, 2: 0.3, 3: 0.2, 4: 0.15 };

type SelectableCar = Pick<Car, "id" | "difficulty">;

/** Per-difficulty quotas for a mixed game of `count` cars (largest-remainder rounding). */
export function mixedPlan(count: number): Record<Difficulty, number> {
  const levels = [1, 2, 3, 4] as const;
  const raw = levels.map((d) => MIXED_WEIGHTS[d] * count);
  const plan = raw.map(Math.floor);
  const order = levels.map((_, i) => i).sort((a, b) => raw[b] - plan[b] - (raw[a] - plan[a]));
  for (let i = 0, left = count - plan.reduce((s, n) => s + n, 0); left > 0; i++, left--) plan[order[i % 4]]++;
  return { 1: plan[0], 2: plan[1], 3: plan[2], 4: plan[3] };
}

/**
 * Picks `count` distinct cars from `pool` for a fixed-length game, easiest first.
 * The difficulty filter is a preference: when a tier runs short it is topped up with the
 * closest tiers. Recently seen cars are used only when nothing fresher is left.
 */
export function selectQuestions(
  pool: readonly SelectableCar[],
  count: number,
  random: () => number,
  { difficulty = "mixed", avoidIds = [] }: { difficulty?: DifficultyFilter; avoidIds?: readonly string[] } = {},
): string[] {
  const avoid = new Set(avoidIds);
  const ordered = [...shuffle(pool.filter((c) => !avoid.has(c.id)), random), ...shuffle(pool.filter((c) => avoid.has(c.id)), random)];
  const target = Math.min(Math.max(0, count), ordered.length);
  const picked: SelectableCar[] = [];
  const taken = new Set<string>();
  const take = (car: SelectableCar) => {
    picked.push(car);
    taken.add(car.id);
  };

  if (difficulty === "mixed") {
    const plan = mixedPlan(target);
    for (const level of [1, 2, 3, 4] as const) {
      for (const car of ordered.filter((c) => c.difficulty === level).slice(0, plan[level])) take(car);
    }
  } else {
    for (const car of ordered.filter((c) => c.difficulty === LEVEL[difficulty]).slice(0, target)) take(car);
  }
  // Top up with the closest difficulties first.
  const goal = difficulty === "mixed" ? 2 : LEVEL[difficulty];
  const rest = ordered.filter((c) => !taken.has(c.id)).sort((a, b) => Math.abs(a.difficulty - goal) - Math.abs(b.difficulty - goal));
  for (const car of rest) {
    if (picked.length >= target) break;
    take(car);
  }
  // Stable sort: a gentle ramp from iconic to expert.
  return picked.sort((a, b) => a.difficulty - b.difficulty).map((c) => c.id);
}

/** Endless mode: the allowed difficulty grows with the number of questions played. */
export function endlessMaxDifficulty(questionIndex: number): Difficulty {
  if (questionIndex < 5) return 1;
  if (questionIndex < 12) return 2;
  if (questionIndex < 20) return 3;
  return 4;
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
