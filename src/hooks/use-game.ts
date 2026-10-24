"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Car } from "@/types/car";
import type { GameState } from "@/types/game";
import { thumbnailUrl } from "@/lib/data/dataset";
import { localDateKey } from "@/lib/game/daily-challenge";
import { configFor, createGame, currentQuestion, gameReducer, timeRemaining, type EngineContext, type GameAction } from "@/lib/game/engine";
import { randomSeed } from "@/lib/game/random";
import type { PlayParams } from "@/lib/game/routes";
import { RESUMABLE_MODES } from "@/lib/game/session";
import { playCue, type SoundCue } from "@/lib/sound";
import { applyGame, type DailyResult } from "@/lib/stats/statistics";
import { sessionStore, settingsStore, statisticsStore } from "./use-persistent";

export type GameRequest = PlayParams;

export type GameInit =
  | { kind: "game"; state: GameState }
  | { kind: "daily-done"; dateKey: string; result: DailyResult }
  | { kind: "unavailable" };

/** A saved session is usable only if every car it references still exists in the catalogue. */
export function savedSession(engine: EngineContext): GameState | null {
  const saved = sessionStore.get();
  if (!saved || saved.phase === "over") return null;
  const known = (id: string) => engine.carsById.has(id);
  return saved.queue.every(known) && saved.questions.every((q) => known(q.carId)) ? saved : null;
}

/** A reload (or "Play" again soon after) picks up the same unfinished game. */
const RESUME_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Resolves what the game page should show. Reads storage, so client-only. */
export function initGame(engine: EngineContext, request: GameRequest, now: number): GameInit {
  const saved = savedSession(engine);
  if (request.resume && saved) return { kind: "game", state: saved };
  if (
    saved &&
    saved.config.mode === request.mode &&
    saved.config.mode !== "daily" &&
    saved.config.category === request.category &&
    (saved.config.make ?? null) === request.make &&
    saved.config.difficulty === request.difficulty &&
    now - saved.startedAt < RESUME_WINDOW_MS
  ) {
    return { kind: "game", state: saved };
  }

  const config = configFor(request.mode, {
    category: request.category,
    make: request.make,
    difficulty: request.difficulty,
    dateKey: localDateKey(new Date(now)),
  });
  if (config.mode === "daily") {
    const result = statisticsStore.get().daily[config.dateKey!];
    if (result) return { kind: "daily-done", dateKey: config.dateKey!, result };
    if (saved?.config.mode === "daily" && saved.config.dateKey === config.dateKey) return { kind: "game", state: saved };
  } else {
    config.dateKey = null;
  }
  if (config.mode === "category" && !config.category && !config.make) return { kind: "unavailable" };

  const state = createGame(engine, config, { seed: randomSeed(), now, avoidIds: statisticsStore.get().recentCarIds });
  return state ? { kind: "game", state } : { kind: "unavailable" };
}

const TIMED_ADVANCE_MS = 900;

function cue(sound: SoundCue) {
  if (settingsStore.get().sound) playCue(sound);
}

/** Drives one game: pure engine transitions plus their side effects (storage, sound, timers). */
export function useGame(engine: EngineContext, initial: GameState) {
  const [state, setState] = useState(initial);
  const stateRef = useRef(initial);
  const [now, setNow] = useState(() => Date.now());
  // Snapshot before this game: personal best and garage, for the results screen.
  const [before] = useState(() => {
    const stats = statisticsStore.get();
    return { best: stats.bestScores[initial.config.mode] ?? 0, collection: new Set(Object.keys(stats.collection)) };
  });

  const apply = useCallback(
    (action: GameAction) => {
      const previous = stateRef.current;
      const next = gameReducer(engine, previous, action);
      if (next === previous) return;
      stateRef.current = next;
      setState(next);

      if (action.type === "submit" && next.lastVerdict) {
        const kind = next.lastVerdict.kind;
        cue(kind === "correct" ? "correct" : kind === "wrong" ? "wrong" : "close");
      }
      if (next.phase === "over" && previous.phase !== "over") cue("finish");
    },
    [engine],
  );

  // Time attack keeps the pace: a correct answer moves on by itself.
  const autoAdvance = state.config.mode === "timed" && state.phase === "feedback";
  const position = state.questions.length;
  useEffect(() => {
    if (!autoAdvance) return;
    const timer = setTimeout(() => {
      const t = Date.now();
      setNow(t);
      apply({ type: "next", now: t });
    }, TIMED_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [autoAdvance, position, apply]);

  // Clock for time attack: timestamps, not interval counting, so background tabs stay accurate.
  const timed = state.endsAt !== null && state.phase !== "over";
  useEffect(() => {
    if (!timed) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      apply({ type: "tick", now: t });
    };
    const interval = setInterval(tick, 200);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [timed, apply]);

  // A car joins the garage as soon as it is identified, even if the game is abandoned.
  useEffect(() => {
    const solved = state.questions.filter((q) => q.status === "solved").map((q) => q.carId);
    if (solved.length === 0) return;
    statisticsStore.set((stats) => {
      const missing = solved.filter((id) => !stats.collection[id]);
      if (missing.length === 0) return stats;
      const today = localDateKey();
      return { ...stats, collection: { ...stats.collection, ...Object.fromEntries(missing.map((id) => [id, today])) } };
    });
  }, [state.questions]);

  // Persistence: save resumable games after every move; record finished games once.
  useEffect(() => {
    if (state.phase === "over") {
      if (sessionStore.get()?.id === state.id) sessionStore.set(null);
      statisticsStore.set((stats) =>
        stats.history.some((g) => g.id === state.id) ? stats : applyGame(stats, state, engine.carsById, new Date()),
      );
    } else if (RESUMABLE_MODES.includes(state.config.mode)) {
      sessionStore.set(state);
    }
  }, [state, engine]);

  // Ask the browser for the next planned photo early (one request, from the remote host).
  const nextId = state.queue[state.questions.length];
  useEffect(() => {
    const nextCar = nextId ? engine.carsById.get(nextId) : undefined;
    if (!nextCar || !navigator.onLine) return;
    const img = new Image();
    img.src = thumbnailUrl(nextCar.image, window.innerWidth > 700 ? 1280 : 960);
  }, [nextId, engine]);

  const question = currentQuestion(state);
  const car = engine.carsById.get(question.carId) as Car;
  const newlyFound = state.questions.filter((q) => q.status === "solved" && !before.collection.has(q.carId)).length;

  return {
    state,
    question,
    car,
    previousBest: before.best,
    newlyFound,
    remainingMs: timeRemaining(state, now),
    submit: (answer: string) => apply({ type: "submit", answer, now: Date.now() }),
    hint: () => apply({ type: "hint" }),
    reveal: () => apply({ type: "reveal", now: Date.now() }),
    next: () => apply({ type: "next", now: Date.now() }),
    replaceCar: () => apply({ type: "replace-car" }),
    quit: () => apply({ type: "quit" }),
  };
}

export type GameController = ReturnType<typeof useGame>;
