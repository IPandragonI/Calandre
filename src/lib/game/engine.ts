import type { Car } from "@/types/car";
import type { GameConfig, GameMode, GameState, QuestionState } from "@/types/game";
import { hintKinds } from "@/lib/data/dataset";
import { buildAnswerIndex, modelKey, validateAnswer, type AnswerIndex } from "./answer-validation";
import { carInCategory, type CategoryId } from "./categories";
import { dailyCarIds, DAILY_QUESTION_COUNT } from "./daily-challenge";
import { endlessMaxDifficulty, pickNextCar, selectQuestions, type DifficultyFilter } from "./question-selection";
import { createRandom, nextRandom } from "./random";
import { questionScore, TIMED_BONUS_SECONDS } from "./scoring";

/** The most hints a car can have (make, period, type, clue); many have fewer. */
export const MAX_HINTS = 4;
export const CLASSIC_QUESTION_COUNT = 10;
export const ENDLESS_LIVES = 3;
export const TIMED_LIMIT_MS = 60_000;
/** Timed mode: the clock never shows more than this after bonuses. */
export const TIMED_MAX_REMAINING_MS = 90_000;

export function configFor(
  mode: GameMode,
  options: { category?: CategoryId | null; make?: string | null; difficulty?: DifficultyFilter; dateKey?: string | null } = {},
): GameConfig {
  const base: GameConfig = {
    mode,
    category: null,
    make: null,
    difficulty: options.difficulty ?? "mixed",
    questionCount: CLASSIC_QUESTION_COUNT,
    maxAttempts: 3,
    lives: null,
    timeLimitMs: null,
    dateKey: null,
  };
  switch (mode) {
    case "classic":
    // Zoom: classic rules, the photo starts cropped and widens with each attempt or hint.
    case "zoom":
    // Generation: classic rules, but the generation must be named.
    case "generation":
      return base;
    case "category":
      return { ...base, category: options.category ?? null, make: options.category ? null : (options.make ?? null) };
    case "daily":
      return { ...base, difficulty: "mixed", questionCount: DAILY_QUESTION_COUNT, dateKey: options.dateKey ?? null };
    case "endless":
      // One attempt per car: every wrong answer costs a life.
      return { ...base, difficulty: "mixed", questionCount: null, maxAttempts: 1, lives: ENDLESS_LIVES };
    case "timed":
      return { ...base, difficulty: "mixed", questionCount: null, maxAttempts: null, timeLimitMs: TIMED_LIMIT_MS };
  }
}

export interface EngineContext {
  cars: readonly Car[];
  carsById: ReadonlyMap<string, Car>;
  /** Every accepted answer in the catalogue, to tell other cars apart from typos. */
  index: AnswerIndex;
  /** Model families with at least two generations in the catalogue. */
  generationFamilies: ReadonlySet<string>;
}

export function createEngineContext(cars: readonly Car[]): EngineContext {
  const generations = new Map<string, number>();
  for (const car of cars) if (car.generation) generations.set(modelKey(car), (generations.get(modelKey(car)) ?? 0) + 1);
  return {
    cars,
    carsById: new Map(cars.map((car) => [car.id, car])),
    index: buildAnswerIndex(cars),
    generationFamilies: new Set([...generations].filter(([, n]) => n >= 2).map(([key]) => key)),
  };
}

/** Cars a game may draw from: category, brand or generation mode narrow the catalogue. */
export function poolFor(ctx: EngineContext, config: GameConfig): readonly Car[] {
  const { category, make, mode } = config;
  if (mode === "generation") return ctx.cars.filter((c) => c.generation && ctx.generationFamilies.has(modelKey(c)));
  if (category) return ctx.cars.filter((c) => carInCategory(c, category));
  if (make) return ctx.cars.filter((c) => c.make === make);
  return ctx.cars;
}

function newQuestion(carId: string): QuestionState {
  return { carId, status: "playing", guesses: [], hintsUsed: 0, points: 0, precise: false };
}

/** Next car for open-ended modes: endless ramps the difficulty up, time attack stays brisk. */
function pickOpenEnded(ctx: EngineContext, state: Pick<GameState, "config" | "questions" | "randomState">) {
  const index = state.questions.length;
  const maxDifficulty = state.config.mode === "endless" ? endlessMaxDifficulty(index) : index < 10 ? 2 : 3;
  return pickNextCar(
    poolFor(ctx, state.config),
    state.questions.map((q) => q.carId),
    maxDifficulty,
    state.randomState,
  );
}

/** Starts a game. Returns null when the dataset cannot supply a single question. */
export function createGame(
  ctx: EngineContext,
  config: GameConfig,
  { seed, now, avoidIds = [] }: { seed: number; now: number; avoidIds?: readonly string[] },
): GameState | null {
  let queue: string[] = [];
  let randomState = seed | 0;
  if (config.mode === "daily") {
    if (!config.dateKey) return null;
    queue = dailyCarIds(ctx.cars, config.dateKey);
  } else if (config.questionCount !== null) {
    const random = createRandom(seed);
    queue = selectQuestions(poolFor(ctx, config), config.questionCount, random, { difficulty: config.difficulty, avoidIds });
    randomState = nextRandom(seed)[1];
  }

  const base = { config, questions: [] as QuestionState[], randomState };
  let firstId: string | null = queue[0] ?? null;
  if (config.questionCount === null) [firstId, randomState] = pickOpenEnded(ctx, base);
  if (!firstId) return null;

  return {
    id: `${config.mode}-${now.toString(36)}-${(seed >>> 0).toString(36)}`,
    config,
    queue,
    questions: [newQuestion(firstId)],
    score: 0,
    streak: 0,
    bestStreak: 0,
    livesLeft: config.lives,
    startedAt: now,
    endsAt: config.timeLimitMs !== null ? now + config.timeLimitMs : null,
    randomState,
    phase: "question",
    lastVerdict: null,
    verdictCount: 0,
  };
}

export type GameAction =
  | { type: "submit"; answer: string; now: number }
  | { type: "hint" }
  /** Give up on the current car: reveals it (classic, daily, endless) or skips it (timed). */
  | { type: "reveal"; now: number }
  | { type: "next"; now: number }
  | { type: "tick"; now: number }
  /** The photo failed to load: swap in another car without penalty. */
  | { type: "replace-car" }
  | { type: "quit" };

export function currentQuestion(state: GameState): QuestionState {
  return state.questions[state.questions.length - 1];
}

function updateCurrent(state: GameState, patch: Partial<QuestionState>): QuestionState[] {
  const questions = [...state.questions];
  questions[questions.length - 1] = { ...questions[questions.length - 1], ...patch };
  return questions;
}

function isTimeUp(state: GameState, now: number): boolean {
  return state.endsAt !== null && now >= state.endsAt;
}

export function timeRemaining(state: GameState, now: number): number {
  return state.endsAt === null ? 0 : Math.max(0, state.endsAt - now);
}

/** Moves to the next car, or ends the game when the mode's end condition is met. */
function advance(ctx: EngineContext, state: GameState, now: number): GameState {
  const ended =
    isTimeUp(state, now) ||
    (state.livesLeft !== null && state.livesLeft <= 0) ||
    (state.config.questionCount !== null && state.questions.length >= state.queue.length);
  if (ended) return { ...state, phase: "over", lastVerdict: null };

  let nextId: string | null;
  let randomState = state.randomState;
  if (state.config.questionCount !== null) nextId = state.queue[state.questions.length] ?? null;
  else [nextId, randomState] = pickOpenEnded(ctx, state);
  if (!nextId) return { ...state, phase: "over", lastVerdict: null };

  return {
    ...state,
    questions: [...state.questions, newQuestion(nextId)],
    randomState,
    phase: "question",
    lastVerdict: null,
  };
}

function fail(state: GameState, status: "missed" | "skipped"): GameState {
  return {
    ...state,
    questions: updateCurrent(state, { status, points: 0 }),
    streak: 0,
    livesLeft: state.livesLeft === null ? null : Math.max(0, state.livesLeft - 1),
    phase: "feedback",
  };
}

export function gameReducer(ctx: EngineContext, state: GameState, action: GameAction): GameState {
  if (state.phase === "over") return state;

  const question = currentQuestion(state);
  const car = ctx.carsById.get(question.carId);

  switch (action.type) {
    case "tick":
      return isTimeUp(state, action.now) ? { ...state, phase: "over", lastVerdict: null } : state;

    case "quit":
      return { ...state, phase: "over", lastVerdict: null };

    case "next":
      return state.phase === "feedback" ? advance(ctx, state, action.now) : state;

    case "hint":
      if (state.phase !== "question" || !car || question.hintsUsed >= hintKinds(car, { makeKnown: Boolean(state.config.make) }).length) return state;
      return { ...state, questions: updateCurrent(state, { hintsUsed: question.hintsUsed + 1 }) };

    case "replace-car": {
      // Photos are hosted remotely: a car whose photo can't load is swapped without penalty
      // (deterministically from the game's random state, so a daily stays fair).
      if (state.phase !== "question") return state;
      const used = new Set([...state.queue, ...state.questions.map((q) => q.carId)]);
      const [roll, randomState] = nextRandom(state.randomState);
      const pool = poolFor(ctx, state.config);
      const sameLevel = pool.filter((c) => !used.has(c.id) && c.difficulty === car?.difficulty);
      const candidates = sameLevel.length > 0 ? sameLevel : pool.filter((c) => !used.has(c.id));
      if (candidates.length === 0) return state;
      const replacement = candidates[Math.floor(roll * candidates.length)].id;
      const queue = state.queue.map((id) => (id === question.carId ? replacement : id));
      return { ...state, queue, randomState, questions: updateCurrent(state, newQuestion(replacement)) };
    }

    case "reveal": {
      if (state.phase !== "question") return state;
      if (state.config.mode === "timed") {
        // Skipping costs only time in timed mode.
        const skipped = { ...state, questions: updateCurrent(state, { status: "skipped", points: 0 }), streak: 0 };
        return advance(ctx, skipped, action.now);
      }
      return { ...fail(state, "skipped"), lastVerdict: null };
    }

    case "submit": {
      if (state.phase !== "question" || !car) return state;
      if (isTimeUp(state, action.now)) return { ...state, phase: "over", lastVerdict: null };

      const verdict = validateAnswer(action.answer, car, ctx.index, {
        requireGeneration: state.config.mode === "generation",
        // Brand challenge: typing the model is enough.
        impliedMake: state.config.make,
      });
      const verdictCount = state.verdictCount + 1;
      if (verdict.kind === "empty" || verdict.kind === "close") {
        return { ...state, lastVerdict: verdict, verdictCount };
      }

      const guesses = [...question.guesses, action.answer.trim()];
      if (verdict.kind === "correct") {
        const points = questionScore({ solved: true, attempts: guesses.length, hintsUsed: question.hintsUsed });
        const streak = state.streak + 1;
        return {
          ...state,
          questions: updateCurrent(state, { status: "solved", guesses, points, precise: verdict.precise }),
          score: state.score + points,
          streak,
          bestStreak: Math.max(state.bestStreak, streak),
          endsAt:
            state.endsAt === null
              ? null
              : Math.min(state.endsAt + TIMED_BONUS_SECONDS * 1000, action.now + TIMED_MAX_REMAINING_MS),
          phase: "feedback",
          lastVerdict: verdict,
          verdictCount,
        };
      }

      const withGuess = { ...state, questions: updateCurrent(state, { guesses }), lastVerdict: verdict, verdictCount };
      const outOfAttempts = state.config.maxAttempts !== null && guesses.length >= state.config.maxAttempts;
      return outOfAttempts ? fail(withGuess, "missed") : withGuess;
    }
  }
}

export interface GameSummary {
  score: number;
  answered: number;
  correct: number;
  /** 0–1, or null when nothing was answered. */
  accuracy: number | null;
  bestStreak: number;
}

export function summarizeGame(state: GameState): GameSummary {
  const answered = state.questions.filter((q) => q.status !== "playing");
  const correct = answered.filter((q) => q.status === "solved").length;
  return {
    score: state.score,
    answered: answered.length,
    correct,
    accuracy: answered.length > 0 ? correct / answered.length : null,
    bestStreak: state.bestStreak,
  };
}
