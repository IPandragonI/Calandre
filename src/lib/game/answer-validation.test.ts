import { describe, expect, it } from "vitest";
import { acceptedAnswersFor, editDistance, normalizeAnswer, validateAnswer } from "./answer-validation";
import { FIXTURE_CARS } from "./test-fixtures";

const car = (id: string) => FIXTURE_CARS.find((c) => c.id === id)!;
const check = (input: string, id: string) => validateAnswer(input, car(id), FIXTURE_CARS);

describe("normalizeAnswer", () => {
  it("ignores case, outer whitespace and repeated spaces", () => {
    expect(normalizeAnswer("  PORSCHE   911 ")).toBe("porsche 911");
  });

  it("strips accents and punctuation, and unifies hyphens", () => {
    expect(normalizeAnswer("Citroën 2-CV!")).toBe("citroen 2 cv");
    expect(normalizeAnswer("Mazda MX-5")).toBe("mazda mx 5");
  });

  it("expands brand nicknames and drops leading articles", () => {
    expect(normalizeAnswer("VW Golf GTI")).toBe("volkswagen golf gti");
    expect(normalizeAnswer("la Merco 300 SL")).toBe("mercedes benz 300 sl");
    expect(normalizeAnswer("Mercedes-Benz 300 SL")).toBe("mercedes benz 300 sl");
    expect(normalizeAnswer("The Lambo Countach")).toBe("lamborghini countach");
  });
});

describe("editDistance", () => {
  it("counts adjacent transpositions as one edit", () => {
    expect(editDistance("supra", "spura")).toBe(1);
    expect(editDistance("supra", "sprua")).toBe(2);
    expect(editDistance("countach", "countach")).toBe(0);
    expect(editDistance("abc", "")).toBe(3);
  });
});

describe("acceptedAnswersFor", () => {
  it("always accepts make + model and make + model + generation", () => {
    const answers = acceptedAnswersFor(car("bmw-m3-e46")).map((a) => a.normalized);
    expect(answers).toContain("bmw m3");
    expect(answers).toContain("bmw m3 e46");
    expect(answers).toContain("bmw e46 m3");
  });

  it("flags aliases that name the generation as precise", () => {
    const answers = acceptedAnswersFor(car("porsche-911"));
    expect(answers.find((a) => a.normalized === "porsche 993")?.precise).toBe(true);
    expect(answers.find((a) => a.normalized === "porsche 911")?.precise).toBe(false);
  });
});

describe("validateAnswer", () => {
  it("accepts equivalent spellings of the correct answer", () => {
    for (const input of ["Porsche 911", "PORSCHE 911", "porsche   911", "911 Porsche", "porsche911"]) {
      expect(check(input, "porsche-911")).toEqual({ kind: "correct", typoTolerated: false, precise: false });
    }
    expect(check("Mazda MX5", "mazda-mx5").kind).toBe("correct");
    expect(check("mazda mx 5", "mazda-mx5").kind).toBe("correct");
    expect(check("Citroen 2 CV", "citroen-2cv").kind).toBe("correct");
    expect(check("VW Golf GTI", "vw-golf").kind).toBe("correct");
  });

  it("accepts explicit aliases and reports generation precision", () => {
    expect(check("Mazda Miata", "mazda-mx5").kind).toBe("correct");
    expect(check("BMW E46 M3", "bmw-m3-e46")).toEqual({ kind: "correct", typoTolerated: false, precise: true });
    expect(check("Porsche 993", "porsche-911")).toEqual({ kind: "correct", typoTolerated: false, precise: true });
  });

  it("tolerates small typos in long alphabetic words", () => {
    expect(check("Lamborgini Countach", "lambo-countach")).toEqual({ kind: "correct", typoTolerated: true, precise: false });
    expect(check("Toyota Sopra", "toyota-supra").kind).toBe("correct");
    expect(check("Porshe 911", "porsche-911").kind).toBe("correct");
  });

  it("never tolerates a different number or a short model code", () => {
    expect(check("Porsche 912", "porsche-911").kind).toBe("wrong");
    expect(check("BMW M5", "bmw-m3-e46").kind).toBe("wrong");
    expect(check("BMW M4", "bmw-m3-e46").kind).toBe("wrong");
    expect(check("Ford GT", "ford-gt40").kind).toBe("wrong");
    expect(check("Ford GT40", "ford-gt").kind).toBe("wrong");
  });

  it("rejects the exact name of another car in the dataset", () => {
    expect(check("BMW M5", "bmw-m3-e46")).toEqual({ kind: "wrong" });
  });

  it("does not accept arbitrary substrings", () => {
    expect(check("BMW", "bmw-m3-e46").kind).not.toBe("correct");
    expect(check("M", "bmw-m3-e46").kind).toBe("wrong");
    expect(check("Porsche", "porsche-911").kind).not.toBe("correct");
    expect(check("911 GT3 RS Porsche Turbo S", "porsche-911").kind).toBe("wrong");
  });

  it("answers near misses with a hint instead of a verdict", () => {
    expect(check("Porsche", "porsche-911")).toEqual({ kind: "close", reason: "make-only" });
    expect(check("Countach", "lambo-countach")).toEqual({ kind: "close", reason: "missing-make" });
    expect(check("M3 E46", "bmw-m3-e46")).toEqual({ kind: "close", reason: "missing-make" });
    expect(check("Porsche 911 Turbo", "porsche-911")).toEqual({ kind: "close", reason: "extra-details" });
    // Two swaps fit the typo budget of a long word; a third edit only earns a hint.
    expect(check("Lambrogihni Countach", "lambo-countach").kind).toBe("correct");
    expect(check("Lanbrogihni Countach", "lambo-countach")).toEqual({ kind: "close", reason: "spelling" });
  });

  it("treats blank input as empty", () => {
    expect(check("   ", "porsche-911")).toEqual({ kind: "empty" });
    expect(check("--", "porsche-911")).toEqual({ kind: "empty" });
  });

  it("rejects clearly wrong answers", () => {
    expect(check("Ferrari F40", "porsche-911")).toEqual({ kind: "wrong" });
    expect(check("Toyota Corolla", "toyota-supra")).toEqual({ kind: "wrong" });
  });
});
