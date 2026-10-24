import type { Locale } from "@/types/car";
import { en } from "./en";
import { fr, type Messages } from "./fr";

export type { Messages };

export const MESSAGES: Record<Locale, Messages> = { fr, en };

const INTL_LOCALES: Record<Locale, string> = { fr: "fr-FR", en: "en-GB" };

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale]).format(value);
}

export function formatPercent(locale: Locale, ratio: number): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale], { style: "percent", maximumFractionDigits: 0 }).format(ratio);
}

/** Formats a YYYY-MM-DD key as a short local date ("24 oct." / "24 Oct"). */
export function formatDateKey(locale: Locale, dateKey: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALES[locale], options).format(new Date(y, m - 1, d));
}
