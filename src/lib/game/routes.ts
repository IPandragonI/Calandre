import type { GameConfig, GameMode } from "@/types/game";
import { GAME_MODES } from "@/types/game";
import { isCategoryId, type CategoryId } from "./categories";
import { DIFFICULTY_FILTERS, type DifficultyFilter } from "./question-selection";

export interface PlayParams {
  mode: GameMode;
  category: CategoryId | null;
  make: string | null;
  difficulty: DifficultyFilter;
  resume: boolean;
}

/** Modes where the player picks a difficulty. */
const DIFFICULTY_MODES: readonly GameMode[] = ["classic", "zoom", "category"];

/** URL of the game page for a mode (and its options). */
export function playHref({
  mode,
  category = null,
  make = null,
  difficulty = "mixed",
}: Partial<Pick<GameConfig, "category" | "make" | "difficulty">> & { mode: GameMode }): string {
  const params = new URLSearchParams({ mode });
  if (category) params.set("category", category);
  else if (make) params.set("make", make);
  if (difficulty !== "mixed" && DIFFICULTY_MODES.includes(mode)) params.set("difficulty", difficulty);
  return `/play?${params}`;
}

/** Reads /play search params, falling back to a classic game for anything unknown. */
export function parsePlayParams(search: { get(name: string): string | null }): PlayParams {
  const mode = search.get("mode");
  const difficulty = search.get("difficulty");
  const category = search.get("category");
  const make = search.get("make")?.trim();
  return {
    mode: GAME_MODES.includes(mode as GameMode) ? (mode as GameMode) : "classic",
    category: isCategoryId(category) ? category : null,
    make: make && make.length <= 60 ? make : null,
    difficulty: DIFFICULTY_FILTERS.includes(difficulty as DifficultyFilter) ? (difficulty as DifficultyFilter) : "mixed",
    resume: search.get("resume") === "1",
  };
}
