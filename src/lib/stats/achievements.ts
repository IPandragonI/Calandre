import type { CategoryId } from "@/lib/game/categories";
import { longestDailyStreak, type Statistics } from "./statistics";

export const ACHIEVEMENT_IDS = [
  "first-car",
  "garage-25",
  "garage-100",
  "garage-500",
  "streak-10",
  "streak-25",
  "perfect-classic",
  "endless-15",
  "timed-1000",
  "generation-700",
  "daily-7",
  "globetrotter",
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export interface Achievement {
  id: AchievementId;
  progress: number;
  target: number;
  unlocked: boolean;
}

const GLOBE: CategoryId[] = ["european", "japanese", "american", "korean"];

/** Achievements are derived from local statistics, so they never drift out of sync. */
export function achievements(stats: Statistics): Achievement[] {
  const found = Object.keys(stats.collection).length;
  const values: Record<AchievementId, [progress: number, target: number]> = {
    "first-car": [Math.min(stats.correctAnswers, 1), 1],
    "garage-25": [found, 25],
    "garage-100": [found, 100],
    "garage-500": [found, 500],
    "streak-10": [stats.bestStreak, 10],
    "streak-25": [stats.bestStreak, 25],
    "perfect-classic": [stats.bestScores.classic ?? 0, 1000],
    "endless-15": [stats.bestScores.endless ?? 0, 1500],
    "timed-1000": [stats.bestScores.timed ?? 0, 1000],
    "generation-700": [stats.bestScores.generation ?? 0, 700],
    "daily-7": [longestDailyStreak(stats.daily), 7],
    globetrotter: [GLOBE.filter((id) => (stats.categoryResults[id]?.correct ?? 0) > 0).length, GLOBE.length],
  };
  return ACHIEVEMENT_IDS.map((id) => {
    const [progress, target] = values[id];
    return { id, progress: Math.min(progress, target), target, unlocked: progress >= target };
  });
}
