import { GAME_MODES, type GameMode, type GameState, type QuestionState } from "@/types/game";
import { isRecord, type StorageSchema } from "@/lib/storage/storage-schema";

/**
 * The game in progress, saved after every move so a reload, a crash or closing
 * the tab doesn't lose it. Timed games are not saved: their clock keeps running.
 */
export const RESUMABLE_MODES: readonly GameMode[] = ["classic", "daily", "endless", "category"];

const QUESTION_STATUSES = ["playing", "solved", "missed", "skipped"];

function isQuestion(value: unknown): value is QuestionState {
  return (
    isRecord(value) &&
    typeof value.carId === "string" &&
    QUESTION_STATUSES.includes(value.status as string) &&
    Array.isArray(value.guesses) &&
    value.guesses.every((g) => typeof g === "string") &&
    typeof value.hintsUsed === "number" &&
    typeof value.points === "number"
  );
}

/** Structural check only; the caller also verifies that every car still exists. */
export function sanitizeSession(data: unknown): GameState | null {
  if (!isRecord(data) || !isRecord(data.config)) return null;
  const { config } = data;
  if (typeof data.id !== "string" || !GAME_MODES.includes(config.mode as GameMode)) return null;
  if (!RESUMABLE_MODES.includes(config.mode as GameMode)) return null;
  if (!Array.isArray(data.queue) || !data.queue.every((id) => typeof id === "string")) return null;
  if (!Array.isArray(data.questions) || data.questions.length === 0 || !data.questions.every(isQuestion)) return null;
  if (!["question", "feedback", "over"].includes(data.phase as string)) return null;
  if (typeof data.score !== "number" || typeof data.randomState !== "number") return null;
  return data as unknown as GameState;
}

export const sessionSchema: StorageSchema<GameState | null> = {
  key: "calandre.session",
  version: 1,
  defaults: () => null,
  sanitize: sanitizeSession,
};
