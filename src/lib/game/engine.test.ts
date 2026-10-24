import { describe, expect, it } from "vitest";
import type { GameState } from "@/types/game";
import { configFor, createEngineContext, createGame, currentQuestion, gameReducer, summarizeGame, type GameAction } from "./engine";
import { FIXTURE_CARS } from "./test-fixtures";
import { hintKinds } from "@/lib/data/dataset";

const ctx = createEngineContext(FIXTURE_CARS);
const NOW = 1_000_000;

function answerFor(state: GameState): string {
  const car = ctx.carsById.get(currentQuestion(state).carId)!;
  return `${car.make} ${car.model}`;
}

function run(state: GameState, ...actions: GameAction[]): GameState {
  return actions.reduce((s, a) => gameReducer(ctx, s, a), state);
}

describe("classic game", () => {
  const start = () => createGame(ctx, configFor("classic"), { seed: 1, now: NOW })!;

  it("plans 10 distinct cars", () => {
    const game = start();
    expect(game.queue).toHaveLength(10);
    expect(new Set(game.queue).size).toBe(10);
    expect(game.questions).toHaveLength(1);
  });

  it("scores a first-try answer and moves on", () => {
    let game = start();
    game = run(game, { type: "submit", answer: answerFor(game), now: NOW });
    expect(game.phase).toBe("feedback");
    expect(game.score).toBe(100);
    expect(game.streak).toBe(1);
    game = run(game, { type: "next", now: NOW });
    expect(game.phase).toBe("question");
    expect(game.questions).toHaveLength(2);
  });

  it("counts wrong attempts, applies hint penalties and reveals after three misses", () => {
    let game = start();
    game = run(game, { type: "hint" }, { type: "submit", answer: "Trabant 601", now: NOW });
    expect(currentQuestion(game).guesses).toEqual(["Trabant 601"]);
    expect(game.phase).toBe("question");
    game = run(game, { type: "submit", answer: answerFor(game), now: NOW });
    expect(currentQuestion(game).points).toBe(70 - 15);

    game = run(game, { type: "next", now: NOW });
    game = run(
      game,
      { type: "submit", answer: "Trabant 601", now: NOW },
      { type: "submit", answer: "Trabant 601", now: NOW },
      { type: "submit", answer: "Trabant 601", now: NOW },
    );
    expect(currentQuestion(game).status).toBe("missed");
    expect(game.phase).toBe("feedback");
    expect(game.streak).toBe(0);
  });

  it("does not consume attempts on near misses or empty input", () => {
    let game = start();
    const car = ctx.carsById.get(currentQuestion(game).carId)!;
    game = run(game, { type: "submit", answer: car.make, now: NOW }, { type: "submit", answer: "  ", now: NOW });
    expect(currentQuestion(game).guesses).toEqual([]);
    expect(game.lastVerdict?.kind).toBe("empty");
  });

  it("caps hints at what the car's data supports", () => {
    const game = run(start(), { type: "hint" }, { type: "hint" }, { type: "hint" }, { type: "hint" }, { type: "hint" });
    const car = ctx.carsById.get(currentQuestion(game).carId)!;
    expect(currentQuestion(game).hintsUsed).toBe(hintKinds(car).length);

    // A car with only a make on record offers a single hint.
    const leafOnly = createEngineContext(FIXTURE_CARS.filter((c) => c.id === "nissan-leaf"));
    let leaf = createGame(leafOnly, configFor("classic"), { seed: 1, now: NOW })!;
    leaf = gameReducer(leafOnly, gameReducer(leafOnly, leaf, { type: "hint" }), { type: "hint" });
    expect(currentQuestion(leaf).hintsUsed).toBe(1);
  });

  it("ends after the last question with a summary", () => {
    let game = start();
    for (let i = 0; i < 10; i++) {
      game = run(game, { type: "submit", answer: answerFor(game), now: NOW }, { type: "next", now: NOW });
    }
    expect(game.phase).toBe("over");
    expect(summarizeGame(game)).toEqual({ score: 1000, answered: 10, correct: 10, accuracy: 1, bestStreak: 10 });
  });

  it("replaces a car whose photo failed, without duplicates", () => {
    const game = start();
    const replaced = run(game, { type: "replace-car" });
    expect(currentQuestion(replaced).carId).not.toBe(currentQuestion(game).carId);
    expect(new Set(replaced.queue).size).toBe(10);
  });
});

describe("endless game", () => {
  it("costs a life per mistake and ends after three", () => {
    let game = createGame(ctx, configFor("endless"), { seed: 3, now: NOW })!;
    for (let i = 0; i < 3; i++) {
      game = run(game, { type: "submit", answer: "Trabant 601", now: NOW });
      expect(game.livesLeft).toBe(2 - i);
      game = run(game, { type: "next", now: NOW });
    }
    expect(game.phase).toBe("over");
  });

  it("starts with an iconic car", () => {
    const game = createGame(ctx, configFor("endless"), { seed: 9, now: NOW })!;
    expect(ctx.carsById.get(currentQuestion(game).carId)!.difficulty).toBe(1);
  });
});

describe("timed game", () => {
  it("adds time for correct answers and ends when the clock runs out", () => {
    let game = createGame(ctx, configFor("timed"), { seed: 5, now: NOW })!;
    expect(game.endsAt).toBe(NOW + 60_000);
    game = run(game, { type: "submit", answer: answerFor(game), now: NOW + 1000 });
    expect(game.endsAt).toBe(NOW + 65_000);
    game = run(game, { type: "next", now: NOW + 2000 }, { type: "tick", now: NOW + 64_000 });
    expect(game.phase).toBe("question");
    game = run(game, { type: "tick", now: NOW + 65_000 });
    expect(game.phase).toBe("over");
  });

  it("skips without revealing a feedback screen", () => {
    const game = createGame(ctx, configFor("timed"), { seed: 5, now: NOW })!;
    const skipped = run(game, { type: "reveal", now: NOW });
    expect(skipped.phase).toBe("question");
    expect(skipped.questions[0].status).toBe("skipped");
  });
});

describe("daily and category games", () => {
  it("uses the date's fixed sequence", () => {
    const a = createGame(ctx, configFor("daily", { dateKey: "2026-10-24" }), { seed: 1, now: NOW })!;
    const b = createGame(ctx, configFor("daily", { dateKey: "2026-10-24" }), { seed: 999, now: NOW })!;
    expect(a.queue).toEqual(b.queue);
    expect(a.queue).toHaveLength(5);
  });

  it("only asks cars from the chosen category", () => {
    const game = createGame(ctx, configFor("category", { category: "european" }), { seed: 1, now: NOW })!;
    for (const id of game.queue) expect(ctx.carsById.get(id)!.region).toBe("europe");
  });

  it("draws a brand challenge from that brand only", () => {
    const game = createGame(ctx, configFor("category", { make: "BMW" }), { seed: 1, now: NOW })!;
    expect(game.queue).toHaveLength(3);
    for (const id of game.queue) expect(ctx.carsById.get(id)!.make).toBe("BMW");
  });

  it("generation mode uses models with several generations and asks for the generation", () => {
    let game = createGame(ctx, configFor("generation"), { seed: 2, now: NOW })!;
    expect(new Set(game.queue)).toEqual(new Set(["bmw-m3-e46", "bmw-m3-e30", "vw-golf-4", "vw-golf-7"]));
    const car = ctx.carsById.get(currentQuestion(game).carId)!;
    game = run(game, { type: "submit", answer: `${car.make} ${car.model}`, now: NOW });
    expect(game.lastVerdict).toEqual({ kind: "close", reason: "generation" });
    expect(currentQuestion(game).guesses).toEqual([]);
    game = run(game, { type: "submit", answer: `${car.make} ${car.model} ${car.generation}`, now: NOW });
    expect(currentQuestion(game)).toMatchObject({ status: "solved", precise: true });
  });

  it("can replace a daily car whose photo fails, deterministically", () => {
    const config = configFor("daily", { dateKey: "2026-10-24" });
    const a = run(createGame(ctx, config, { seed: 1, now: NOW })!, { type: "replace-car" });
    const b = run(createGame(ctx, config, { seed: 1, now: NOW })!, { type: "replace-car" });
    expect(currentQuestion(a).carId).toBe(currentQuestion(b).carId);
    expect(a.queue).not.toContain(createGame(ctx, config, { seed: 1, now: NOW })!.queue[0]);
  });

  it("cannot start without cars", () => {
    const empty = createEngineContext([]);
    expect(createGame(empty, configFor("classic"), { seed: 1, now: NOW })).toBeNull();
    expect(createGame(empty, configFor("endless"), { seed: 1, now: NOW })).toBeNull();
  });
});
