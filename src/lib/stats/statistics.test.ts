import { describe, expect, it } from "vitest";
import { configFor, createEngineContext, createGame, currentQuestion, gameReducer, type GameAction } from "@/lib/game/engine";
import { FIXTURE_CARS } from "@/lib/game/test-fixtures";
import { decode, encode } from "@/lib/storage/storage-schema";
import type { GameState } from "@/types/game";
import {
  applyGame,
  dailyStreak,
  emptyStatistics,
  favoriteCategory,
  HISTORY_LIMIT,
  overallAccuracy,
  sanitizeStatistics,
  statisticsSchema,
} from "./statistics";

const ctx = createEngineContext(FIXTURE_CARS);
const run = (state: GameState, ...actions: GameAction[]) => actions.reduce((s, a) => gameReducer(ctx, s, a), state);

/** A finished game where the player gets the first `correct` planned cars right and reveals the rest. */
function finishedGame(mode: "classic" | "daily", correct: number, seed = 1): GameState {
  let game = createGame(ctx, configFor(mode, { dateKey: "2026-10-24" }), { seed, now: 0 })!;
  for (let i = 0; i < game.queue.length; i++) {
    const car = ctx.carsById.get(currentQuestion(game).carId)!;
    game = i < correct ? run(game, { type: "submit", answer: `${car.make} ${car.model}`, now: 0 }) : run(game, { type: "reveal", now: 0 });
    game = run(game, { type: "next", now: 0 });
  }
  return game;
}

describe("applyGame", () => {
  it("accumulates totals, best scores and streaks", () => {
    const stats = applyGame(emptyStatistics(), finishedGame("classic", 10), ctx.carsById, new Date(2026, 9, 24));
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.questionsAnswered).toBe(10);
    expect(stats.correctAnswers).toBe(10);
    expect(stats.currentStreak).toBe(10);
    expect(stats.bestStreak).toBe(10);
    expect(stats.bestScores.classic).toBe(1000);
    expect(stats.history[0]).toMatchObject({ mode: "classic", dateKey: "2026-10-24", correct: 10, answered: 10 });
    expect(overallAccuracy(stats)).toBe(1);

    const next = applyGame(stats, finishedGame("classic", 3, 2), ctx.carsById, new Date(2026, 9, 25));
    expect(next.bestScores.classic).toBe(1000);
    expect(next.bestStreak).toBe(13);
    // The game ended on 7 misses, so the running streak is broken.
    expect(next.currentStreak).toBe(0);
    expect(overallAccuracy(next)).toBe(13 / 20);
  });

  it("records a daily result once, with per-question outcomes", () => {
    const stats = applyGame(emptyStatistics(), finishedGame("daily", 2), ctx.carsById, new Date(2026, 9, 24));
    expect(stats.daily["2026-10-24"]).toEqual({ score: 200, correct: 2, total: 5, outcomes: [1, 1, 0, 0, 0] });
    const again = applyGame(stats, finishedGame("daily", 5), ctx.carsById, new Date(2026, 9, 24));
    expect(again.daily["2026-10-24"].correct).toBe(2);
  });

  it("tracks per-category results and keeps the history bounded", () => {
    let stats = emptyStatistics();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) stats = applyGame(stats, finishedGame("classic", 10, i), ctx.carsById, new Date());
    expect(stats.history).toHaveLength(HISTORY_LIMIT);
    expect(favoriteCategory(stats)?.id).toBe("european");
  });
});

describe("dailyStreak", () => {
  const result = { score: 100, correct: 1, total: 5, outcomes: [1, 0, 0, 0, 0] as (0 | 1)[] };
  it("counts consecutive days ending today or yesterday", () => {
    const daily = { "2026-10-22": result, "2026-10-23": result, "2026-10-24": result, "2026-10-20": result };
    expect(dailyStreak(daily, new Date(2026, 9, 24, 12))).toBe(3);
    expect(dailyStreak(daily, new Date(2026, 9, 25, 12))).toBe(3);
    expect(dailyStreak(daily, new Date(2026, 9, 27, 12))).toBe(0);
  });
});

describe("statistics persistence", () => {
  it("round-trips through the storage envelope", () => {
    const stats = applyGame(emptyStatistics(), finishedGame("classic", 4), ctx.carsById, new Date(2026, 9, 24));
    expect(decode(statisticsSchema, encode(statisticsSchema, stats))).toEqual(stats);
  });

  it("salvages valid fields from damaged data", () => {
    const clean = sanitizeStatistics({
      gamesPlayed: 4,
      questionsAnswered: 10,
      correctAnswers: 99,
      bestScores: { classic: 500, endless: -3, nonsense: 10 },
      history: [{ id: "x", mode: "classic", dateKey: "2026-10-24", score: 10 }, { id: 3 }, "garbage"],
      daily: { "2026-10-24": { outcomes: [1, 2, 9] }, bogus: { outcomes: [] } },
      recentCarIds: ["a", 2, "b"],
    })!;
    expect(clean.gamesPlayed).toBe(4);
    expect(clean.correctAnswers).toBe(10);
    expect(clean.bestScores).toEqual({ classic: 500 });
    expect(clean.history).toHaveLength(1);
    expect(clean.daily).toEqual({});
    expect(clean.recentCarIds).toEqual(["a", "b"]);
  });
});
