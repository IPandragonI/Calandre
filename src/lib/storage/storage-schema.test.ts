import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, settingsSchema } from "@/lib/settings";
import { sessionSchema } from "@/lib/game/session";
import { configFor, createEngineContext, createGame } from "@/lib/game/engine";
import { FIXTURE_CARS } from "@/lib/game/test-fixtures";
import { decode, encode, isRecord, type StorageSchema } from "./storage-schema";

interface Prefs {
  name: string;
  volume: number;
}

/** A schema at version 3 that once stored { username } (v1), then { name, vol } (v2). */
const prefsSchema: StorageSchema<Prefs> = {
  key: "test.prefs",
  version: 3,
  defaults: () => ({ name: "anon", volume: 50 }),
  migrations: {
    1: (d) => ({ name: isRecord(d) ? d.username : undefined, vol: 5 }),
    2: (d) => (isRecord(d) ? { name: d.name, volume: Number(d.vol) * 10 } : d),
  },
  sanitize: (d) => (isRecord(d) && typeof d.name === "string" && typeof d.volume === "number" ? { name: d.name, volume: d.volume } : null),
};

describe("decode", () => {
  it("falls back to defaults for missing, malformed or foreign data", () => {
    expect(decode(prefsSchema, null)).toEqual({ name: "anon", volume: 50 });
    expect(decode(prefsSchema, "{not json")).toEqual({ name: "anon", volume: 50 });
    expect(decode(prefsSchema, '"just a string"')).toEqual({ name: "anon", volume: 50 });
    expect(decode(prefsSchema, '{"data":{}}')).toEqual({ name: "anon", volume: 50 });
  });

  it("ignores data written by a newer version", () => {
    expect(decode(prefsSchema, JSON.stringify({ v: 4, data: { name: "x", volume: 1 } }))).toEqual({ name: "anon", volume: 50 });
  });

  it("migrates old versions step by step", () => {
    expect(decode(prefsSchema, JSON.stringify({ v: 1, data: { username: "Ana" } }))).toEqual({ name: "Ana", volume: 50 });
    expect(decode(prefsSchema, JSON.stringify({ v: 2, data: { name: "Bo", vol: 3 } }))).toEqual({ name: "Bo", volume: 30 });
  });

  it("round-trips the current version", () => {
    const value = { name: "Cy", volume: 7 };
    expect(decode(prefsSchema, encode(prefsSchema, value))).toEqual(value);
  });

  it("uses defaults when a migration is missing or throws", () => {
    const broken: StorageSchema<Prefs> = {
      ...prefsSchema,
      migrations: {
        1: () => {
          throw new Error("boom");
        },
      },
    };
    expect(decode(broken, JSON.stringify({ v: 1, data: {} }))).toEqual({ name: "anon", volume: 50 });
    expect(decode(broken, JSON.stringify({ v: 2, data: {} }))).toEqual({ name: "anon", volume: 50 });
  });
});

describe("settings schema", () => {
  it("defaults to French and the light theme", () => {
    expect(decode(settingsSchema, null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.locale).toBe("fr");
    expect(DEFAULT_SETTINGS.theme).toBe("light");
  });

  it("keeps valid fields and repairs invalid ones", () => {
    const raw = JSON.stringify({ v: 1, data: { locale: "en", theme: "neon", sound: "yes", difficulty: "hard" } });
    expect(decode(settingsSchema, raw)).toEqual({ ...DEFAULT_SETTINGS, locale: "en", difficulty: "hard" });
  });
});

describe("session schema", () => {
  const ctx = createEngineContext(FIXTURE_CARS);

  it("restores a saved game", () => {
    const game = createGame(ctx, configFor("classic"), { seed: 1, now: 0 })!;
    expect(decode(sessionSchema, encode(sessionSchema, game))).toEqual(game);
  });

  it("refuses timed games and broken payloads", () => {
    const timed = createGame(ctx, configFor("timed"), { seed: 1, now: 0 })!;
    expect(decode(sessionSchema, encode(sessionSchema, timed))).toBeNull();
    expect(decode(sessionSchema, JSON.stringify({ v: 1, data: { id: "x", config: { mode: "classic" } } }))).toBeNull();
  });
});
