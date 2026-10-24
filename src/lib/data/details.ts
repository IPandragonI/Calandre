import type { Localized } from "@/types/car";

/** Key facts, as stated in Wikidata (absent when not recorded — never estimated). */
export interface CarFacts {
  designers?: string[];
  engines?: string[];
  assembly?: Localized;
  produced?: number;
  massKg?: number;
  lengthMm?: number;
  topSpeedKmh?: number;
}

export interface CarDetails {
  /** Opening sentences of the car's Wikipedia article (CC BY-SA), per language when available. */
  description?: Partial<Localized>;
  facts?: CarFacts;
}

export const DETAILS_SHARDS = 32;

/** Which /details/{n}.json file holds a car (FNV-1a of the id). */
export function detailsShard(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % DETAILS_SHARDS;
}

const shardCache = new Map<number, Promise<Record<string, CarDetails>>>();

/** Loads one car's details (one small shard, fetched once and memoised). */
export async function loadCarDetails(id: string): Promise<CarDetails | null> {
  const shard = detailsShard(id);
  let pending = shardCache.get(shard);
  if (!pending) {
    pending = fetch(`/details/${shard}.json`).then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json() as Promise<Record<string, CarDetails>>;
    });
    // A failed shard can be retried later.
    pending.catch(() => shardCache.delete(shard));
    shardCache.set(shard, pending);
  }
  return (await pending)[id] ?? null;
}
