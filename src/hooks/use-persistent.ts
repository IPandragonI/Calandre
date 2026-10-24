"use client";

import { useSyncExternalStore } from "react";
import { createPersistentStore, type PersistentStore } from "@/lib/storage/local-storage";
import { settingsSchema, type Settings } from "@/lib/settings";
import { statisticsSchema, type Statistics } from "@/lib/stats/statistics";
import { sessionSchema } from "@/lib/game/session";
import type { GameState } from "@/types/game";

export const settingsStore = createPersistentStore<Settings>(settingsSchema);
export const statisticsStore = createPersistentStore<Statistics>(statisticsSchema);
export const sessionStore = createPersistentStore<GameState | null>(sessionSchema);

/**
 * Reads a persistent store. The server and the hydration pass see the defaults;
 * React then re-renders with the stored value, so there is no hydration mismatch.
 */
export function usePersistent<T>(store: PersistentStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.getServerSnapshot);
}

export function updateSettings(patch: Partial<Settings>): void {
  settingsStore.set((s) => ({ ...s, ...patch }));
}

export function useSettings(): Settings {
  return usePersistent(settingsStore);
}

export function useStatistics(): Statistics {
  return usePersistent(statisticsStore);
}

const noopSubscribe = () => () => {};

/** False during server rendering and hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
