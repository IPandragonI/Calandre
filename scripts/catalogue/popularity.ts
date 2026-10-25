// Popularity phase: Wikipedia page views (fr + en, human readers) over a fixed 12-month
// window, the main signal behind each car's recognisability score. Cached per article in
// data/catalogue/cache/pageviews.json; bump WINDOW to refresh the figures.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fetchWithRetry, sleep } from "../lib/commons";

export type Wiki = "fr" | "en";

/** Twelve full months, as YYYYMMDDHH bounds for the Wikimedia pageviews API. */
export const WINDOW = { start: "2025100100", end: "2026093000" } as const;

interface Cache {
  window: string;
  views: Record<string, number>;
}

const key = (wiki: Wiki, title: string) => `${wiki}:${title}`;

/** "https://fr.wikipedia.org/wiki/Renault_Clio" → ["fr", "Renault Clio"]. */
export function articleOf(url: string | undefined): [Wiki, string] | null {
  const m = url?.match(/^https:\/\/(fr|en)\.wikipedia\.org\/wiki\/(.+)$/);
  return m ? [m[1] as Wiki, decodeURIComponent(m[2]).replace(/_/g, " ")] : null;
}

/**
 * Total views of each article over WINDOW. Unknown articles count as 0 (the API answers
 * 404 when an article had no views or does not exist). Fetched 3 at a time, politely, cached.
 */
export async function fetchPageviews(articles: Iterable<[Wiki, string]>, cachePath: string): Promise<(wiki: Wiki, title: string) => number> {
  const windowId = `${WINDOW.start}-${WINDOW.end}`;
  const loaded: Cache | null = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : null;
  const cache: Cache = loaded?.window === windowId ? loaded : { window: windowId, views: {} };
  const unique = new Map<string, [Wiki, string]>();
  for (const [wiki, title] of articles) unique.set(key(wiki, title), [wiki, title]);
  const missing = [...unique].filter(([k]) => !(k in cache.views)).map(([, a]) => a);
  if (missing.length > 0) console.log(`Fetching page views for ${missing.length} articles…`);

  let done = 0;
  const worker = async (queue: [Wiki, string][]) => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [wiki, title] = next;
      const url =
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${wiki}.wikipedia/all-access/user/` +
        `${encodeURIComponent(title.replace(/ /g, "_"))}/monthly/${WINDOW.start}/${WINDOW.end}`;
      const res = await fetchWithRetry(url);
      const data = res.ok ? ((await res.json()) as { items?: { views: number }[] }) : { items: [] };
      cache.views[key(wiki, title)] = (data.items ?? []).reduce((sum, item) => sum + item.views, 0);
      done++;
      if (done % 100 === 0) {
        process.stdout.write(`\r  ${done}/${missing.length}`);
        writeFileSync(cachePath, JSON.stringify(cache));
      }
      await sleep(150);
    }
  };
  const queue = [...missing];
  await Promise.all(Array.from({ length: 3 }, () => worker(queue)));
  if (missing.length > 0) process.stdout.write(`\r  ${missing.length}/${missing.length}\n`);
  writeFileSync(cachePath, JSON.stringify(cache));
  return (wiki, title) => cache.views[key(wiki, title)] ?? 0;
}
