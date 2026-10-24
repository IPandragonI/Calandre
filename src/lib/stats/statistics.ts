import type { Car } from "@/types/car";
import { GAME_MODES, type GameMode, type GameState } from "@/types/game";
import { categoriesOf, isCategoryId, type CategoryId } from "@/lib/game/categories";
import { isDateKey, localDateKey } from "@/lib/game/daily-challenge";
import { isRecord, pickNumber, type StorageSchema } from "@/lib/storage/storage-schema";

export interface GameRecord {
  id: string;
  mode: GameMode;
  category: CategoryId | null;
  /** Local date the game ended (YYYY-MM-DD). */
  dateKey: string;
  score: number;
  correct: number;
  answered: number;
  bestStreak: number;
}

/** Per question of a daily challenge: attempts used to solve it (1–3), or 0 if missed. */
export type DailyOutcome = 0 | 1 | 2 | 3;

export interface DailyResult {
  score: number;
  correct: number;
  total: number;
  outcomes: DailyOutcome[];
}

export interface Tally {
  seen: number;
  correct: number;
}

export interface Statistics {
  gamesPlayed: number;
  questionsAnswered: number;
  correctAnswers: number;
  /** Consecutive correct answers across games. */
  currentStreak: number;
  bestStreak: number;
  bestScores: Partial<Record<GameMode, number>>;
  /** Games played per chosen category (category mode). */
  categoryPlays: Partial<Record<CategoryId, number>>;
  /** Answers per car category, whatever the mode. */
  categoryResults: Partial<Record<CategoryId, Tally>>;
  daily: Record<string, DailyResult>;
  /** Most recent last; used to avoid showing the same cars game after game. */
  recentCarIds: string[];
  /** Most recent last. */
  history: GameRecord[];
}

export const HISTORY_LIMIT = 50;
export const RECENT_CARS_LIMIT = 40;
export const DAILY_LIMIT = 120;

export function emptyStatistics(): Statistics {
  return {
    gamesPlayed: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    currentStreak: 0,
    bestStreak: 0,
    bestScores: {},
    categoryPlays: {},
    categoryResults: {},
    daily: {},
    recentCarIds: [],
    history: [],
  };
}

function lastEntries<T>(items: T[], limit: number): T[] {
  return items.length > limit ? items.slice(items.length - limit) : items;
}

/** Per planned car of a fixed-length game: the attempt it was solved on, or 0. */
export function dailyOutcomes(game: Pick<GameState, "queue" | "questions">): DailyOutcome[] {
  return game.queue.map((carId) => {
    const q = game.questions.find((question) => question.carId === carId);
    return q?.status === "solved" ? (Math.min(q.guesses.length, 3) as DailyOutcome) : 0;
  });
}

/** Folds a finished game into the statistics. Pure: returns a new object. */
export function applyGame(
  stats: Statistics,
  game: GameState,
  carsById: ReadonlyMap<string, Pick<Car, "region" | "tags">>,
  finishedAt: Date,
): Statistics {
  const answered = game.questions.filter((q) => q.status !== "playing");
  const correct = answered.filter((q) => q.status === "solved").length;
  const { mode, category, dateKey } = game.config;

  let currentStreak = stats.currentStreak;
  let bestStreak = stats.bestStreak;
  const categoryResults: Statistics["categoryResults"] = { ...stats.categoryResults };
  for (const q of answered) {
    const solved = q.status === "solved";
    currentStreak = solved ? currentStreak + 1 : 0;
    bestStreak = Math.max(bestStreak, currentStreak);
    const car = carsById.get(q.carId);
    for (const id of car ? categoriesOf(car) : []) {
      const tally = categoryResults[id] ?? { seen: 0, correct: 0 };
      categoryResults[id] = { seen: tally.seen + 1, correct: tally.correct + (solved ? 1 : 0) };
    }
  }

  const record: GameRecord = {
    id: game.id,
    mode,
    category,
    dateKey: localDateKey(finishedAt),
    score: game.score,
    correct,
    answered: answered.length,
    bestStreak: game.bestStreak,
  };

  const daily = { ...stats.daily };
  if (mode === "daily" && dateKey && !daily[dateKey]) {
    daily[dateKey] = { score: game.score, correct, total: game.queue.length, outcomes: dailyOutcomes(game) };
  }
  const dailyKeys = Object.keys(daily).sort();
  for (const key of dailyKeys.slice(0, Math.max(0, dailyKeys.length - DAILY_LIMIT))) delete daily[key];

  return {
    gamesPlayed: stats.gamesPlayed + 1,
    questionsAnswered: stats.questionsAnswered + answered.length,
    correctAnswers: stats.correctAnswers + correct,
    currentStreak,
    bestStreak,
    bestScores: { ...stats.bestScores, [mode]: Math.max(stats.bestScores[mode] ?? 0, game.score) },
    categoryPlays: category ? { ...stats.categoryPlays, [category]: (stats.categoryPlays[category] ?? 0) + 1 } : stats.categoryPlays,
    categoryResults,
    daily,
    recentCarIds: lastEntries(
      [...stats.recentCarIds.filter((id) => !game.questions.some((q) => q.carId === id)), ...answered.map((q) => q.carId)],
      RECENT_CARS_LIMIT,
    ),
    history: lastEntries([...stats.history, record], HISTORY_LIMIT),
  };
}

/** 0–1, or null before the first answer. */
export function overallAccuracy(stats: Pick<Statistics, "questionsAnswered" | "correctAnswers">): number | null {
  return stats.questionsAnswered > 0 ? stats.correctAnswers / stats.questionsAnswered : null;
}

/** Highest score across all modes. */
export function bestScoreOverall(stats: Pick<Statistics, "bestScores">): number {
  return Math.max(0, ...Object.values(stats.bestScores).filter((n): n is number => typeof n === "number"));
}

/** Consecutive days with a completed daily challenge, ending today (or yesterday if today isn't done yet). */
export function dailyStreak(daily: Statistics["daily"], today: Date): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!daily[localDateKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (daily[localDateKey(cursor)]) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Category with the most answers (needs at least 5), with its accuracy. */
export function favoriteCategory(stats: Pick<Statistics, "categoryResults">): { id: CategoryId; tally: Tally } | null {
  let best: { id: CategoryId; tally: Tally } | null = null;
  for (const [id, tally] of Object.entries(stats.categoryResults)) {
    if (!isCategoryId(id) || !tally || tally.seen < 5) continue;
    if (!best || tally.seen > best.tally.seen) best = { id, tally };
  }
  return best;
}

// ── Persistence ────────────────────────────────────────────────────────────

function sanitizeTally(value: unknown): Tally | null {
  if (!isRecord(value)) return null;
  const seen = pickNumber(value.seen, -1);
  const correct = pickNumber(value.correct, -1);
  return seen >= 0 && correct >= 0 && correct <= seen ? { seen, correct } : null;
}

function sanitizeRecord(value: unknown): GameRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !GAME_MODES.includes(value.mode as GameMode) || !isDateKey(value.dateKey)) return null;
  return {
    id: value.id,
    mode: value.mode as GameMode,
    category: isCategoryId(value.category) ? value.category : null,
    dateKey: value.dateKey,
    score: pickNumber(value.score, 0),
    correct: pickNumber(value.correct, 0),
    answered: pickNumber(value.answered, 0),
    bestStreak: pickNumber(value.bestStreak, 0),
  };
}

function sanitizeDaily(value: unknown): DailyResult | null {
  if (!isRecord(value) || !Array.isArray(value.outcomes)) return null;
  const outcomes = value.outcomes.filter((o): o is DailyOutcome => o === 0 || o === 1 || o === 2 || o === 3);
  if (outcomes.length !== value.outcomes.length) return null;
  return {
    score: pickNumber(value.score, 0),
    correct: pickNumber(value.correct, 0),
    total: pickNumber(value.total, outcomes.length),
    outcomes,
  };
}

/** Keeps every valid field of stored statistics and resets the rest. */
export function sanitizeStatistics(data: unknown): Statistics | null {
  if (!isRecord(data)) return null;
  const empty = emptyStatistics();

  const bestScores: Statistics["bestScores"] = {};
  if (isRecord(data.bestScores)) {
    for (const mode of GAME_MODES) {
      const score = pickNumber(data.bestScores[mode], -1);
      if (score >= 0) bestScores[mode] = score;
    }
  }
  const categoryPlays: Statistics["categoryPlays"] = {};
  const categoryResults: Statistics["categoryResults"] = {};
  if (isRecord(data.categoryPlays)) {
    for (const [id, count] of Object.entries(data.categoryPlays)) {
      if (isCategoryId(id) && pickNumber(count, -1) >= 0) categoryPlays[id] = count as number;
    }
  }
  if (isRecord(data.categoryResults)) {
    for (const [id, tally] of Object.entries(data.categoryResults)) {
      const clean = sanitizeTally(tally);
      if (isCategoryId(id) && clean) categoryResults[id] = clean;
    }
  }
  const daily: Statistics["daily"] = {};
  if (isRecord(data.daily)) {
    for (const [key, result] of Object.entries(data.daily)) {
      const clean = sanitizeDaily(result);
      if (isDateKey(key) && clean) daily[key] = clean;
    }
  }

  const questionsAnswered = pickNumber(data.questionsAnswered, 0);
  return {
    gamesPlayed: pickNumber(data.gamesPlayed, empty.gamesPlayed),
    questionsAnswered,
    correctAnswers: Math.min(pickNumber(data.correctAnswers, 0), questionsAnswered),
    currentStreak: pickNumber(data.currentStreak, 0),
    bestStreak: pickNumber(data.bestStreak, 0),
    bestScores,
    categoryPlays,
    categoryResults,
    daily,
    recentCarIds: Array.isArray(data.recentCarIds)
      ? lastEntries(data.recentCarIds.filter((id): id is string => typeof id === "string"), RECENT_CARS_LIMIT)
      : [],
    history: Array.isArray(data.history)
      ? lastEntries(data.history.map(sanitizeRecord).filter((r): r is GameRecord => r !== null), HISTORY_LIMIT)
      : [],
  };
}

export const statisticsSchema: StorageSchema<Statistics> = {
  key: "calandre.statistics",
  version: 1,
  defaults: emptyStatistics,
  sanitize: sanitizeStatistics,
};
