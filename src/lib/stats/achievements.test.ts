import { describe, expect, it } from "vitest";
import { achievements } from "./achievements";
import { emptyStatistics } from "./statistics";

const find = (list: ReturnType<typeof achievements>, id: string) => list.find((a) => a.id === id)!;

describe("achievements", () => {
  it("are all locked for a new player", () => {
    expect(achievements(emptyStatistics()).every((a) => !a.unlocked && a.progress === 0)).toBe(true);
  });

  it("unlock from local statistics and report capped progress", () => {
    const stats = {
      ...emptyStatistics(),
      correctAnswers: 40,
      bestStreak: 12,
      bestScores: { classic: 1000 },
      collection: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`car-${i}`, "2026-10-24"])),
      categoryResults: { european: { seen: 3, correct: 2 }, japanese: { seen: 2, correct: 1 } },
    };
    const list = achievements(stats);
    expect(find(list, "first-car").unlocked).toBe(true);
    expect(find(list, "garage-25").unlocked).toBe(true);
    expect(find(list, "garage-100")).toMatchObject({ unlocked: false, progress: 30, target: 100 });
    expect(find(list, "streak-10").unlocked).toBe(true);
    expect(find(list, "streak-25").progress).toBe(12);
    expect(find(list, "perfect-classic").unlocked).toBe(true);
    expect(find(list, "globetrotter")).toMatchObject({ progress: 2, target: 4, unlocked: false });
  });
});
