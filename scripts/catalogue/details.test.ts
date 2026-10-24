import { describe, expect, it } from "vitest";
import { detailsShard, DETAILS_SHARDS } from "../../src/lib/data/details";
import type { Entity } from "../lib/wikidata";
import { articleTitle, factsFor, trimExtract } from "./details";

const quantity = (amount: string, unit: string) => ({ mainsnak: { datavalue: { value: { amount, unit } } }, rank: "normal" as const });
const item = (id: string) => ({ mainsnak: { datavalue: { value: { id } } }, rank: "normal" as const });

describe("descriptions", () => {
  it("decodes Wikipedia article titles", () => {
    expect(articleTitle("https://fr.wikipedia.org/wiki/Citro%C3%ABn_2CV")).toBe("Citroën 2CV");
  });

  it("keeps the first sentences within a budget and drops parentheses", () => {
    const text = "La Ferrari F40 (1987) est une supercar. Elle a été produite à Maranello. " + "Une phrase très longue. ".repeat(40);
    const out = trimExtract(text, 120)!;
    expect(out.startsWith("La Ferrari F40 est une supercar. Elle a été produite à Maranello.")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(trimExtract("Trop court.")).toBeNull();
    expect(trimExtract("La Bugatti Veyron 16.4 est une hypercar produite de 2005 à 2015. Elle est assemblée à Molsheim.")).toBe(
      "La Bugatti Veyron 16.4 est une hypercar produite de 2005 à 2015. Elle est assemblée à Molsheim.",
    );
  });
});

describe("facts", () => {
  const entities = new Map<string, Entity>([
    ["Q1", { id: "Q1", labels: { en: { value: "Giorgetto Giugiaro" } } }],
    ["Q2", { id: "Q2", labels: { en: { value: "Maranello" }, fr: { value: "Maranello" } } }],
  ]);
  const car: Entity = {
    id: "Qcar",
    claims: {
      P287: [item("Q1")],
      P1071: [item("Q2")],
      P1092: [quantity("+1311", "1")],
      P2067: [quantity("+1100", "http://www.wikidata.org/entity/Q11570")],
      P2043: [quantity("+4.358", "http://www.wikidata.org/entity/Q11573")],
      P2052: [quantity("+201", "http://www.wikidata.org/entity/Q211256")],
    },
  };

  it("reads stated facts and converts known units", () => {
    expect(factsFor(car, entities)).toEqual({
      designers: ["Giorgetto Giugiaro"],
      assembly: { fr: "Maranello", en: "Maranello" },
      produced: 1311,
      massKg: 1100,
      lengthMm: 4358,
      topSpeedKmh: 323,
    });
  });

  it("leaves out unknown units and implausible values rather than guessing", () => {
    const odd: Entity = {
      id: "Qodd",
      claims: {
        P2067: [quantity("+3", "http://www.wikidata.org/entity/Q999")],
        P2052: [quantity("+2000", "http://www.wikidata.org/entity/Q180154")],
      },
    };
    expect(factsFor(odd, entities)).toEqual({});
    expect(factsFor(undefined, entities)).toEqual({});
  });
});

describe("detailsShard", () => {
  it("is stable and within range", () => {
    expect(detailsShard("q1075802")).toBe(detailsShard("q1075802"));
    for (const id of ["a", "bmw-m3-e46", "q172610"]) {
      expect(detailsShard(id)).toBeGreaterThanOrEqual(0);
      expect(detailsShard(id)).toBeLessThan(DETAILS_SHARDS);
    }
  });
});
