import { decode, encode, type StorageSchema } from "./storage-schema";

/** localStorage, or null when unavailable (server, privacy mode, blocked storage). */
function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    const probe = "__calandre_probe__";
    s.setItem(probe, probe);
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function isStorageAvailable(): boolean {
  return storage() !== null;
}

export function readItem(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeItem(key: string, value: string | null): boolean {
  try {
    const s = storage();
    if (!s) return false;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
    return true;
  } catch {
    // Quota exceeded or storage revoked: keep playing with in-memory state.
    return false;
  }
}

export interface PersistentStore<T> {
  get: () => T;
  /** Value used during server rendering and hydration. */
  getServerSnapshot: () => T;
  set: (next: T | ((previous: T) => T)) => void;
  reset: () => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * A typed value persisted in localStorage, usable with useSyncExternalStore.
 * Falls back to memory when storage is unavailable, and follows changes made
 * in other tabs.
 */
export function createPersistentStore<T>(schema: StorageSchema<T>): PersistentStore<T> {
  const listeners = new Set<() => void>();
  const serverValue = schema.defaults();
  let cache: { raw: string | null; value: T } | null = null;
  let memoryOnly: T | null = null;

  const get = (): T => {
    if (typeof window === "undefined") return serverValue;
    if (memoryOnly !== null) return memoryOnly;
    const raw = readItem(schema.key);
    if (!cache || cache.raw !== raw) cache = { raw, value: decode(schema, raw) };
    return cache.value;
  };

  const emit = () => listeners.forEach((l) => l());

  const set: PersistentStore<T>["set"] = (next) => {
    const value = typeof next === "function" ? (next as (p: T) => T)(get()) : next;
    const raw = encode(schema, value);
    if (writeItem(schema.key, raw)) {
      memoryOnly = null;
      cache = { raw, value };
    } else {
      memoryOnly = value;
    }
    emit();
  };

  return {
    get,
    getServerSnapshot: () => serverValue,
    set,
    reset: () => {
      writeItem(schema.key, null);
      memoryOnly = null;
      cache = null;
      emit();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === schema.key || event.key === null) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}
