"use client";

import { useEffect } from "react";
import { useI18n } from "@/hooks/use-i18n";
import { useSettings } from "@/hooks/use-persistent";
import { THEME_COLORS, THEME_NAMES } from "@/lib/settings";

/** Keeps <html> lang, theme, motion preference and browser chrome colour in sync with settings. */
export function DocumentSync() {
  const { theme, locale, reducedMotion } = useSettings();
  const { t } = useI18n();

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dataset.theme = THEME_NAMES[theme];
    if (reducedMotion) root.dataset.reducedMotion = "true";
    else delete root.dataset.reducedMotion;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", THEME_COLORS[theme]));
  }, [theme, locale, reducedMotion]);

  useEffect(() => {
    // Only the default title is localised here; pages with their own title keep it.
    if (document.title.startsWith("Calandre —")) document.title = t.meta.title;
  }, [t]);

  return null;
}
