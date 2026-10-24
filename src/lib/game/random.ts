/**
 * Small deterministic PRNG (mulberry32) whose whole state is one 32-bit integer,
 * so it can live inside serialisable game state and be resumed after a reload.
 */
export function nextRandom(state: number): [value: number, nextState: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Stateful convenience wrapper for one-off sequences. */
export function createRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    const [value, next] = nextRandom(state);
    state = next;
    return value;
  };
}

/** FNV-1a 32-bit hash: turns a string (e.g. a date) into a seed. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function randomSeed(): number {
  return (Math.random() * 0x100000000) >>> 0;
}
