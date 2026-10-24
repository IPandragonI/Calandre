// Wikidata helpers for the catalogue builder (SPARQL listing + batched entity fetches).
import { getJson, sleep, USER_AGENT } from "./commons";

const SPARQL = "https://query.wikidata.org/sparql";
const API = "https://www.wikidata.org/w/api.php";

export async function sparql(query: string): Promise<Record<string, string>[]> {
  const data = await getJson<{ results: { bindings: Record<string, { value: string }>[] } }>(
    `${SPARQL}?${new URLSearchParams({ query, format: "json" })}`,
    { headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT } },
  );
  return data.results.bindings.map((row) =>
    Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v.value.replace("http://www.wikidata.org/entity/", "")])),
  );
}

interface Snak {
  datavalue?: { value: unknown };
}
export interface Claim {
  mainsnak: Snak;
  rank: "preferred" | "normal" | "deprecated";
}
export interface Entity {
  id: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, Claim[]>;
  sitelinks?: Record<string, { title: string; url?: string }>;
}

/** Fetches entities 50 at a time (labels, aliases, claims and fr/en Wikipedia links). */
export async function getEntities(ids: string[], onBatch?: (done: number) => void): Promise<Entity[]> {
  const out: Entity[] = [];
  let lagRetries = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: ids.slice(i, i + 50).join("|"),
      props: "labels|aliases|claims|sitelinks/urls",
      languages: "fr|en",
      sitefilter: "frwiki|enwiki",
      format: "json",
    });
    // Back off when the servers are badly lagged (API etiquette); reads tolerate a little lag.
    if (lagRetries < 6) params.set("maxlag", "20");
    const data = await getJson<{ entities?: Record<string, Entity & { missing?: string }>; error?: { code: string } }>(
      `${API}?${params}`,
    );
    if (data.error?.code === "maxlag") {
      lagRetries++;
      await sleep(10_000);
      i -= 50;
      continue;
    }
    if (data.error) throw new Error(`Wikidata API error: ${data.error.code}`);
    lagRetries = 0;
    for (const entity of Object.values(data.entities ?? {})) if (entity.missing === undefined) out.push(entity);
    onBatch?.(Math.min(i + 50, ids.length));
    await sleep(250);
  }
  return out;
}

/** Values of a property, best rank first, deprecated statements ignored. */
export function claimValues(entity: Entity | undefined, property: string): unknown[] {
  const claims = (entity?.claims?.[property] ?? []).filter((c) => c.rank !== "deprecated");
  const preferred = claims.filter((c) => c.rank === "preferred");
  return (preferred.length > 0 ? preferred : claims).map((c) => c.mainsnak.datavalue?.value).filter((v) => v !== undefined);
}

export function claimIds(entity: Entity | undefined, property: string): string[] {
  return claimValues(entity, property)
    .map((v) => (typeof v === "object" && v !== null && "id" in v ? String((v as { id: string }).id) : null))
    .filter((v): v is string => v !== null);
}

/** Year of the first time-valued claim among the given properties (year precision or finer). */
export function claimYear(entity: Entity | undefined, properties: string[]): number | null {
  for (const p of properties) {
    for (const v of claimValues(entity, p)) {
      if (typeof v !== "object" || v === null || !("time" in v)) continue;
      const { time, precision } = v as { time: string; precision: number };
      const match = time.match(/^\+(\d{4})-/);
      // Decades and centuries are too vague for a hint.
      if (match && precision >= 9) return Number(match[1]);
    }
  }
  return null;
}

export function label(entity: Entity | undefined, lang: "fr" | "en"): string | null {
  return entity?.labels?.[lang]?.value ?? null;
}
