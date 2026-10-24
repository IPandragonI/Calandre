import { describe, expect, it } from "vitest";
import { HINT_PENALTY, potentialScore, questionScore } from "./scoring";

describe("questionScore", () => {
  it("rewards fewer attempts", () => {
    expect(questionScore({ solved: true, attempts: 1, hintsUsed: 0 })).toBe(100);
    expect(questionScore({ solved: true, attempts: 2, hintsUsed: 0 })).toBe(70);
    expect(questionScore({ solved: true, attempts: 3, hintsUsed: 0 })).toBe(40);
    // Unlimited-attempt modes keep the floor of the last tier.
    expect(questionScore({ solved: true, attempts: 7, hintsUsed: 0 })).toBe(40);
  });

  it("deducts a fixed penalty per hint", () => {
    expect(questionScore({ solved: true, attempts: 1, hintsUsed: 2 })).toBe(100 - 2 * HINT_PENALTY);
  });

  it("never goes negative", () => {
    expect(questionScore({ solved: true, attempts: 3, hintsUsed: 4 })).toBe(0);
  });

  it("gives nothing for skipped or failed questions", () => {
    expect(questionScore({ solved: false, attempts: 3, hintsUsed: 0 })).toBe(0);
    expect(questionScore({ solved: true, attempts: 0, hintsUsed: 0 })).toBe(0);
  });

  it("previews the value of the next correct answer", () => {
    expect(potentialScore(0, 1)).toBe(100 - HINT_PENALTY);
    expect(potentialScore(1, 0)).toBe(70);
  });
});
