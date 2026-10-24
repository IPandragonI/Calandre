import type { DailyOutcome } from "@/lib/stats/statistics";

/** Spoiler-free daily grid: solved on attempt 1/2/3, or missed. */
const OUTCOME_EMOJI: Record<DailyOutcome, string> = { 1: "🟩", 2: "🟨", 3: "🟧", 0: "⬛" };

export function dailyGrid(outcomes: readonly DailyOutcome[]): string {
  return outcomes.map((o) => OUTCOME_EMOJI[o]).join("");
}

export function canShare(): boolean {
  return typeof navigator !== "undefined" && (typeof navigator.share === "function" || !!navigator.clipboard);
}

/** Native share sheet when available, clipboard otherwise. */
export async function shareText(text: string): Promise<"shared" | "copied" | "failed"> {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ text });
      return "shared";
    }
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    // The user closed the share sheet, or clipboard access was denied.
    return "failed";
  }
}
