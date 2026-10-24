import type { AnswerVerdict } from "@/lib/game/answer-validation";
import type { CategoryId } from "@/lib/game/categories";
import type { DifficultyFilter } from "@/lib/game/question-selection";

export const GAME_MODES = ["classic", "daily", "endless", "timed", "category", "generation", "zoom"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export interface GameConfig {
  mode: GameMode;
  category: CategoryId | null;
  /** Brand challenge: only this make's cars. */
  make: string | null;
  difficulty: DifficultyFilter;
  /** Fixed number of questions, or null for open-ended modes. */
  questionCount: number | null;
  /** Attempts per question, or null for unlimited. */
  maxAttempts: number | null;
  /** Mistakes allowed before game over, or null. */
  lives: number | null;
  timeLimitMs: number | null;
  /** Local date of a daily challenge (YYYY-MM-DD). */
  dateKey: string | null;
}

export type QuestionStatus = "playing" | "solved" | "missed" | "skipped";

export interface QuestionState {
  carId: string;
  status: QuestionStatus;
  /** Every scored submission, the correct one included. */
  guesses: string[];
  hintsUsed: number;
  points: number;
  /** The player also named the right generation/variant. */
  precise: boolean;
}

export type GamePhase = "question" | "feedback" | "over";

export interface GameState {
  id: string;
  config: GameConfig;
  /** Car ids planned in advance (fixed-length modes); empty for open-ended modes. */
  queue: string[];
  questions: QuestionState[];
  score: number;
  streak: number;
  bestStreak: number;
  livesLeft: number | null;
  startedAt: number;
  /** Timed mode deadline (epoch ms), extended by correct answers. */
  endsAt: number | null;
  randomState: number;
  phase: GamePhase;
  /** Outcome of the latest submission, for feedback UI. */
  lastVerdict: AnswerVerdict | null;
  /** Increments on every submission so identical verdicts still re-trigger feedback. */
  verdictCount: number;
}
