"use client";

import { useMemo } from "react";
import type { Locale } from "@/types/car";
import { formatDateKey, formatNumber, formatPercent, MESSAGES, type Messages } from "@/lib/i18n";
import { useSettings } from "./use-persistent";

export interface I18n {
  locale: Locale;
  t: Messages;
  number: (value: number) => string;
  percent: (ratio: number) => string;
  date: (dateKey: string, options?: Intl.DateTimeFormatOptions) => string;
}

/** Messages and formatters for the player's language (French until hydrated). */
export function useI18n(): I18n {
  const { locale } = useSettings();
  return useMemo(
    () => ({
      locale,
      t: MESSAGES[locale],
      number: (value) => formatNumber(locale, value),
      percent: (ratio) => formatPercent(locale, ratio),
      date: (dateKey, options) => formatDateKey(locale, dateKey, options),
    }),
    [locale],
  );
}
