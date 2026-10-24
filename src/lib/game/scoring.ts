/** Points for a correct answer on the 1st, 2nd and 3rd (or later) attempt. */
export const ATTEMPT_POINTS = [100, 70, 40] as const;

/** Deducted per hint revealed on a question. */
export const HINT_PENALTY = 15;

/** Seconds added to the clock for each correct answer in timed mode. */
export const TIMED_BONUS_SECONDS = 5;

export interface QuestionOutcome {
  solved: boolean;
  /** Attempts used, including the successful one. */
  attempts: number;
  hintsUsed: number;
}

/** Points earned on one question; never negative, zero when skipped or failed. */
export function questionScore({ solved, attempts, hintsUsed }: QuestionOutcome): number {
  if (!solved || attempts < 1) return 0;
  const base = ATTEMPT_POINTS[Math.min(attempts, ATTEMPT_POINTS.length) - 1];
  return Math.max(0, base - hintsUsed * HINT_PENALTY);
}

/** What the next correct answer would be worth, shown in the hint button. */
export function potentialScore(attemptsSoFar: number, hintsUsed: number): number {
  return questionScore({ solved: true, attempts: attemptsSoFar + 1, hintsUsed });
}
