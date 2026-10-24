import type { Car } from "@/types/car";
import { selectQuestions } from "./question-selection";
import { createRandom, hashString } from "./random";

export const DAILY_QUESTION_COUNT = 5;

/** Changing the salt reshuffles every future (and past) daily challenge. */
const DAILY_SALT = "calandre-daily-v1";

/** Day 1 of the daily challenge numbering. */
const FIRST_DAY_UTC = Date.UTC(2026, 0, 1);

/** The player's local calendar date as YYYY-MM-DD. */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Challenge number shown to players ("Défi n°42"), counted from 2026-01-01. */
export function dailyNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - FIRST_DAY_UTC) / 86_400_000) + 1;
}

/**
 * The same car sequence for everyone on a given date. Cars are sorted by id
 * first, so the order of entries in cars.json does not matter.
 */
export function dailyCarIds(
  cars: readonly Pick<Car, "id" | "difficulty" | "region" | "tags">[],
  dateKey: string,
  count = DAILY_QUESTION_COUNT,
): string[] {
  const sorted = [...cars].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return selectQuestions(sorted, count, createRandom(hashString(`${DAILY_SALT}:${dateKey}`)));
}
