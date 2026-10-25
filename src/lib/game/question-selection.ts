import type { Car, Difficulty } from "@/types/car";
import type { GameMode } from "@/types/game";
import { modelKey } from "./answer-validation";
import { nextRandom, shuffle } from "./random";

export const DIFFICULTY_FILTERS = ["mixed", "easy", "medium", "hard"] as const;
export type DifficultyFilter = (typeof DIFFICULTY_FILTERS)[number];

/** Reads a stored or linked difficulty; the former fourth tier ("expert") is now "hard". */
export function parseDifficultyFilter(value: unknown): DifficultyFilter | null {
  if (value === "expert") return "hard";
  return DIFFICULTY_FILTERS.includes(value as DifficultyFilter) ? (value as DifficultyFilter) : null;
}

const LEVEL: Record<Exclude<DifficultyFilter, "mixed">, Difficulty> = { easy: 1, medium: 2, hard: 3 };
const LEVELS = [1, 2, 3] as const;

/** Share of each difficulty in a "mixed" game: mostly recognisable, some real challenges. */
const MIXED_WEIGHTS: Record<Difficulty, number> = { 1: 0.4, 2: 0.35, 3: 0.25 };

type SelectableCar = Pick<Car, "id" | "difficulty" | "make" | "model">;

/**
 * Difficulty as a mode experiences it: naming the exact generation is a step harder than
 * recognising the model (a Clio is easy, telling a Clio III from a Clio IV is not).
 */
export function effectiveDifficulty(car: Pick<Car, "difficulty" | "generation">, mode: GameMode): Difficulty {
  return mode === "generation" && car.generation ? (Math.min(3, car.difficulty + 1) as Difficulty) : car.difficulty;
}

/** Per-difficulty quotas for a mixed game of `count` cars (largest-remainder rounding). */
export function mixedPlan(count: number): Record<Difficulty, number> {
  const raw = LEVELS.map((d) => MIXED_WEIGHTS[d] * count);
  const plan = raw.map(Math.floor);
  const order = LEVELS.map((_, i) => i).sort((a, b) => raw[b] - plan[b] - (raw[a] - plan[a]));
  for (let i = 0, left = count - plan.reduce((s, n) => s + n, 0); left > 0; i++, left--) plan[order[i % LEVELS.length]]++;
  return { 1: plan[0], 2: plan[1], 3: plan[2] };
}

/**
 * Picks `count` distinct cars from `pool` for a fixed-length game, easiest first.
 *
 * - A chosen difficulty only borrows from the neighbouring tier when it runs short (easy
 *   never shows hard cars); the game is shorter rather than unfair.
 * - Variety: one car per model family, and no make takes more than a quarter of the game
 *   (unless the pool is a single make), relaxed only when the pool can't supply enough.
 * - Recently seen cars are used only when nothing fresher is left.
 */
export function selectQuestions(
  pool: readonly SelectableCar[],
  count: number,
  random: () => number,
  { difficulty = "mixed", avoidIds = [] }: { difficulty?: DifficultyFilter; avoidIds?: readonly string[] } = {},
): string[] {
  const avoid = new Set(avoidIds);
  const ordered = [...shuffle(pool.filter((c) => !avoid.has(c.id)), random), ...shuffle(pool.filter((c) => avoid.has(c.id)), random)];
  const goal = difficulty === "mixed" ? null : LEVEL[difficulty];
  const allowed = ordered.filter((c) => goal === null || Math.abs(c.difficulty - goal) <= 1);
  const target = Math.min(Math.max(0, count), allowed.length);

  const picked: SelectableCar[] = [];
  const taken = new Set<string>();
  const families = new Set<string>();
  const perMake = new Map<string, number>();
  const makeCap = new Set(pool.map((c) => c.make)).size <= 1 ? Infinity : Math.max(2, Math.ceil(target / 4));
  /** Takes up to `quota` cars from `candidates`, loosening the variety rules pass by pass. */
  const fill = (candidates: readonly SelectableCar[], quota: number) => {
    const rules = [
      (c: SelectableCar) => !families.has(modelKey(c)) && (perMake.get(c.make) ?? 0) < makeCap,
      (c: SelectableCar) => !families.has(modelKey(c)),
      () => true,
    ];
    let left = quota;
    for (const ok of rules) {
      for (const car of candidates) {
        if (left <= 0) return;
        if (taken.has(car.id) || !ok(car)) continue;
        picked.push(car);
        taken.add(car.id);
        families.add(modelKey(car));
        perMake.set(car.make, (perMake.get(car.make) ?? 0) + 1);
        left--;
      }
    }
  };

  if (goal === null) {
    const plan = mixedPlan(target);
    for (const level of LEVELS) fill(allowed.filter((c) => c.difficulty === level), plan[level]);
  } else {
    fill(allowed.filter((c) => c.difficulty === goal), target);
  }
  // Top up with the closest tiers.
  const centre = goal ?? 2;
  fill(
    [...allowed].sort((a, b) => Math.abs(a.difficulty - centre) - Math.abs(b.difficulty - centre)),
    target - picked.length,
  );
  // Stable sort: a gentle ramp from familiar to obscure.
  return picked.sort((a, b) => a.difficulty - b.difficulty).map((c) => c.id);
}

/** Endless mode: the allowed difficulty grows with the number of questions played. */
export function endlessMaxDifficulty(questionIndex: number): Difficulty {
  if (questionIndex < 6) return 1;
  if (questionIndex < 15) return 2;
  return 3;
}

/**
 * Picks the next car for open-ended modes, avoiding repeats until the pool is exhausted,
 * and the makes and model families of the last few cars when possible.
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
  const byId = new Map(cars.map((c) => [c.id, c]));
  const lastCars = seenIds.slice(-3).flatMap((id) => byId.get(id) ?? []);
  const fresh = pool.filter((c) => lastCars.every((last) => last.make !== c.make && modelKey(last) !== modelKey(c)));
  if (fresh.length > 0) pool = fresh;
  // Lean towards the hardest allowed tier so the difficulty actually ramps up.
  const top = pool.filter((c) => c.difficulty === maxDifficulty);
  let [roll, state] = nextRandom(randomState);
  if (top.length > 0 && roll < 0.6) pool = top;
  [roll, state] = nextRandom(state);
  return [pool[Math.floor(roll * pool.length)].id, state];
}
