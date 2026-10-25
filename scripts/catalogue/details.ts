// Details phase: per-car descriptions (Wikipedia intro extracts) and key facts (Wikidata),
// written as small shards in public/details/ so the game catalogue stays light.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Car } from "../../src/types/car";
import { detailsShard, type CarDetails, type CarFacts } from "../../src/lib/data/details";
import { getJson, sleep } from "../lib/commons";
import { claimIds, claimValues, label, type Entity } from "../lib/wikidata";

type Lang = "fr" | "en";

/** "https://fr.wikipedia.org/wiki/Ferrari_F40" → "Ferrari F40". */
export function articleTitle(url: string): string {
  return decodeURIComponent(url.replace(/^https:\/\/[a-z]+\.wikipedia\.org\/wiki\//, "")).replace(/_/g, " ");
}

/** Keeps the first sentences of an extract, within a length budget. */
export function trimExtract(text: string, maxLength = 420): string | null {
  const clean = text.replace(/\s+/g, " ").replace(/\s*\([^()]*\)/g, "").trim();
  if (clean.length < 40) return null;
  // Sentence ends: punctuation, then a space and a capital — so "16.4" or "J.-P." don't split.
  const sentences = clean.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Þ«"])/).map((s) => `${s} `);
  let out = "";
  for (const s of sentences) {
    if (out && (out + s).length > maxLength) break;
    out += s;
  }
  return (out || clean.slice(0, maxLength)).trim();
}

/** Intro extracts for a list of article titles, 20 per request, cached. */
export async function fetchExtracts(lang: Lang, titles: string[], cachePath: string): Promise<Record<string, string>> {
  const cache: Record<string, string> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  const missing = [...new Set(titles)].filter((t) => !(t in cache));
  if (missing.length > 0) console.log(`Fetching ${missing.length} ${lang} Wikipedia extracts…`);
  for (let i = 0; i < missing.length; i += 20) {
    const batch = missing.slice(i, i + 20);
    const params = new URLSearchParams({
      action: "query",
      prop: "extracts",
      exintro: "1",
      explaintext: "1",
      exsentences: "4",
      exlimit: "20",
      redirects: "1",
      format: "json",
      titles: batch.join("|"),
    });
    const data = await getJson<{
      query?: {
        normalized?: { from: string; to: string }[];
        redirects?: { from: string; to: string }[];
        pages?: Record<string, { title: string; extract?: string }>;
      };
    }>(`https://${lang}.wikipedia.org/w/api.php?${params}`);
    const byTitle = new Map(Object.values(data.query?.pages ?? {}).map((p) => [p.title, p.extract ?? ""]));
    const resolve = (t: string) => {
      let title = t;
      for (const step of [data.query?.normalized, data.query?.redirects]) title = step?.find((n) => n.from === title)?.to ?? title;
      return title;
    };
    for (const t of batch) cache[t] = byTitle.get(resolve(t)) ?? "";
    process.stdout.write(`\r  ${Math.min(i + 20, missing.length)}/${missing.length}`);
    if ((i / 20) % 25 === 24) writeFileSync(cachePath, JSON.stringify(cache));
    await sleep(200);
  }
  if (missing.length > 0) process.stdout.write("\n");
  writeFileSync(cachePath, JSON.stringify(cache));
  return cache;
}

// Wikidata units we know how to convert (anything else is left out rather than guessed).
const MM: Record<string, number> = { Q174789: 1, Q11573: 1000, Q174728: 10, Q218593: 25.4 };
const KG: Record<string, number> = { Q11570: 1, Q100995: 0.45359237 };
const KMH: Record<string, number> = { Q180154: 1, Q211256: 1.609344 };

function quantity(entity: Entity | undefined, property: string, units: Record<string, number>): number | null {
  for (const v of claimValues(entity, property)) {
    if (typeof v !== "object" || v === null || !("amount" in v)) continue;
    const { amount, unit } = v as { amount: string; unit: string };
    const factor = units[unit.replace("http://www.wikidata.org/entity/", "")];
    const value = Number(amount);
    if (factor && Number.isFinite(value) && value > 0) return Math.round(value * factor);
  }
  return null;
}

/** A unitless count stated in Wikidata (e.g. P1092 units built). */
export function statedCount(entity: Entity | undefined, property: string): number | null {
  for (const v of claimValues(entity, property)) {
    if (typeof v !== "object" || v === null || !("amount" in v)) continue;
    const { amount, unit } = v as { amount: string; unit: string };
    const value = Number(amount);
    // Unitless counts only ("1" means no unit in Wikidata).
    if (unit === "1" && Number.isInteger(value) && value > 0) return value;
  }
  return null;
}

/** Key facts stated in Wikidata, with plausibility bounds; nothing is inferred. */
export function factsFor(entity: Entity | undefined, entities: Map<string, Entity>): CarFacts {
  const names = (property: string) =>
    claimIds(entity, property)
      .map((id) => label(entities.get(id), "en") ?? label(entities.get(id), "fr"))
      .filter((l): l is string => Boolean(l) && !/^Q\d+$/.test(l!));
  const placeNames = (lang: Lang) =>
    claimIds(entity, "P1071")
      .map((id) => label(entities.get(id), lang) ?? label(entities.get(id), lang === "fr" ? "en" : "fr"))
      .filter((l): l is string => Boolean(l));
  const facts: CarFacts = {};
  const designers = names("P287");
  if (designers.length > 0) facts.designers = designers.slice(0, 3);
  const engines = names("P516");
  if (engines.length > 0) facts.engines = engines.slice(0, 3);
  const fr = placeNames("fr");
  const en = placeNames("en");
  if (fr.length > 0 && en.length > 0) facts.assembly = { fr: fr.slice(0, 3).join(", "), en: en.slice(0, 3).join(", ") };
  const produced = statedCount(entity, "P1092");
  if (produced) facts.produced = produced;
  const mass = quantity(entity, "P2067", KG);
  if (mass && mass >= 300 && mass <= 6000) facts.massKg = mass;
  const length = quantity(entity, "P2043", MM);
  if (length && length >= 2000 && length <= 7000) facts.lengthMm = length;
  const speed = quantity(entity, "P2052", KMH);
  if (speed && speed >= 60 && speed <= 500) facts.topSpeedKmh = speed;
  return facts;
}

export async function writeDetails(
  cars: readonly Car[],
  entities: Map<string, Entity>,
  { cacheDir, outDir, itemOf = (car) => car.wikidata }: { cacheDir: string; outDir: string; itemOf?: (car: Car) => string | undefined },
): Promise<{ withDescription: number; withFacts: number }> {
  const titles = (lang: Lang) => cars.map((c) => c.links?.[lang]).filter((u): u is string => Boolean(u)).map(articleTitle);
  const extracts = {
    fr: await fetchExtracts("fr", titles("fr"), `${cacheDir}/extracts-fr.json`),
    en: await fetchExtracts("en", titles("en"), `${cacheDir}/extracts-en.json`),
  };

  const shards = new Map<number, Record<string, CarDetails>>();
  let withDescription = 0;
  let withFacts = 0;
  for (const car of cars) {
    const description: Partial<Record<Lang, string>> = {};
    for (const lang of ["fr", "en"] as const) {
      const url = car.links?.[lang];
      const text = url ? trimExtract(extracts[lang][articleTitle(url)] ?? "") : null;
      if (text) description[lang] = text;
    }
    const item = itemOf(car);
    const facts = factsFor(item ? entities.get(item) : undefined, entities);
    const details: CarDetails = {
      ...(Object.keys(description).length > 0 ? { description } : {}),
      ...(Object.keys(facts).length > 0 ? { facts } : {}),
    };
    if (details.description) withDescription++;
    if (details.facts) withFacts++;
    const shard = detailsShard(car.id);
    if (!shards.has(shard)) shards.set(shard, {});
    shards.get(shard)![car.id] = details;
  }

  mkdirSync(outDir, { recursive: true });
  for (const file of readdirSync(outDir)) rmSync(`${outDir}/${file}`);
  for (const [shard, content] of [...shards].sort((a, b) => a[0] - b[0])) {
    writeFileSync(`${outDir}/${shard}.json`, JSON.stringify(content));
  }
  return { withDescription, withFacts };
}
