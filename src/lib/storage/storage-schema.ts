/**
 * Versioned JSON envelope for everything kept in localStorage: { v, data }.
 * Older versions are migrated step by step; malformed, unknown or future data
 * falls back to defaults instead of crashing the app.
 */
export interface StorageSchema<T> {
  key: string;
  version: number;
  defaults: () => T;
  /** migrations[n] upgrades data stored with version n to version n + 1. */
  migrations?: Record<number, (data: unknown) => unknown>;
  /** Returns a valid value (salvaging what it can) or null to use the defaults. */
  sanitize: (data: unknown) => T | null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function decode<T>(schema: StorageSchema<T>, raw: string | null): T {
  if (raw === null) return schema.defaults();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return schema.defaults();
  }
  if (!isRecord(parsed) || typeof parsed.v !== "number" || !Number.isInteger(parsed.v)) return schema.defaults();
  if (parsed.v > schema.version) return schema.defaults();

  let data = parsed.data;
  for (let v = parsed.v; v < schema.version; v++) {
    const migrate = schema.migrations?.[v];
    if (!migrate) return schema.defaults();
    try {
      data = migrate(data);
    } catch {
      return schema.defaults();
    }
  }
  return schema.sanitize(data) ?? schema.defaults();
}

export function encode<T>(schema: StorageSchema<T>, value: T): string {
  return JSON.stringify({ v: schema.version, data: value });
}

// Field helpers for sanitizers: keep a valid stored value, otherwise the fallback.

export function pickNumber(value: unknown, fallback: number, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

export function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}
