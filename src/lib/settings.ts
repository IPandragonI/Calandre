import type { Locale } from "@/types/car";
import { parseDifficultyFilter, type DifficultyFilter } from "@/lib/game/question-selection";
import { isRecord, pickBoolean, pickEnum, type StorageSchema } from "@/lib/storage/storage-schema";

export const LOCALES = ["fr", "en"] as const satisfies readonly Locale[];
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export interface Settings {
  locale: Locale;
  theme: Theme;
  sound: boolean;
  /** Forces reduced motion even when the OS doesn't ask for it. */
  reducedMotion: boolean;
  /** Last difficulty chosen for the classic quiz. */
  difficulty: DifficultyFilter;
}

export const DEFAULT_SETTINGS: Settings = {
  locale: "fr",
  theme: "light",
  sound: true,
  reducedMotion: false,
  difficulty: "mixed",
};

export const SETTINGS_KEY = "calandre.settings";

export const settingsSchema: StorageSchema<Settings> = {
  key: SETTINGS_KEY,
  version: 1,
  defaults: () => ({ ...DEFAULT_SETTINGS }),
  sanitize: (data) => {
    if (!isRecord(data)) return null;
    return {
      locale: pickEnum(data.locale, LOCALES, DEFAULT_SETTINGS.locale),
      theme: pickEnum(data.theme, THEMES, DEFAULT_SETTINGS.theme),
      sound: pickBoolean(data.sound, DEFAULT_SETTINGS.sound),
      reducedMotion: pickBoolean(data.reducedMotion, DEFAULT_SETTINGS.reducedMotion),
      difficulty: parseDifficultyFilter(data.difficulty) ?? DEFAULT_SETTINGS.difficulty,
    };
  },
};

/** DaisyUI theme names declared in globals.css. */
export const THEME_NAMES: Record<Theme, string> = { light: "calandre-light", dark: "calandre-dark" };

/** Browser chrome colour per theme (matches base-100 in globals.css). */
export const THEME_COLORS: Record<Theme, string> = { light: "#f7f6f2", dark: "#121315" };

/**
 * Inline <head> script: applies the saved theme, language and motion preference
 * before first paint, so there is no flash of the wrong theme.
 */
export const PREFERENCES_SCRIPT = `try{var r=localStorage.getItem(${JSON.stringify(SETTINGS_KEY)});var s=r?(JSON.parse(r).data||{}):{};var d=document.documentElement;d.dataset.theme=s.theme==="dark"?"${THEME_NAMES.dark}":"${THEME_NAMES.light}";d.lang=s.locale==="en"?"en":"fr";if(s.reducedMotion===true)d.dataset.reducedMotion="true";}catch(e){}`;
