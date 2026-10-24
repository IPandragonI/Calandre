// Fetch phase of the catalogue builder: everything is cached in data/catalogue/cache/,
// so reruns are fast, offline-capable and idempotent. --refresh refetches.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fetchFileInfos, sleep, type CommonsFileInfo } from "../lib/commons";
import { claimIds, claimValues, getEntities, sparql, type Entity } from "../lib/wikidata";

export interface CandidateRow {
  id: string;
  sitelinks: number;
  seriesSitelinks: number;
}

export interface FetchedData {
  candidates: CandidateRow[];
  entities: Map<string, Entity>;
  files: Map<string, CommonsFileInfo>;
}

/** Item types listed: automobile model and concept car. */
const ITEM_TYPES = ["Q3231690", "Q850270"];

function readCache<T>(path: string): T | null {
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : null;
}

function writeCache(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value));
}

/** Commons titles use spaces, not underscores, and a capitalised first letter. */
export function normalizeFileTitle(title: string): string {
  const name = title.replace(/^File:/, "").replace(/_/g, " ").trim();
  return `File:${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

export async function fetchAll(
  cacheDir: string,
  { refresh, minSitelinks, extraFiles }: { refresh: boolean; minSitelinks: number; extraFiles: string[] },
): Promise<FetchedData> {
  mkdirSync(cacheDir, { recursive: true });
  const paths = {
    candidates: `${cacheDir}/candidates.json`,
    entities: `${cacheDir}/entities.json`,
    files: `${cacheDir}/files.json`,
  };

  // 1. Candidate list: car items with a main image (P18) and enough Wikipedia articles.
  let candidates = refresh ? null : readCache<CandidateRow[]>(paths.candidates);
  if (!candidates) {
    console.log("Querying Wikidata for candidate cars…");
    const rows = await sparql(`
      SELECT ?car (MAX(?sl) AS ?sitelinks) (MAX(?ssl) AS ?seriesSitelinks) WHERE {
        VALUES ?type { ${ITEM_TYPES.map((t) => `wd:${t}`).join(" ")} }
        ?car wdt:P31 ?type ; wdt:P18 ?img ; wikibase:sitelinks ?sl .
        OPTIONAL { ?car wdt:P179 ?series . ?series wikibase:sitelinks ?ssl . }
        FILTER(?sl >= ${minSitelinks})
      } GROUP BY ?car`);
    candidates = rows
      .map((r) => ({ id: r.car, sitelinks: Number(r.sitelinks), seriesSitelinks: Number(r.seriesSitelinks ?? 0) }))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    writeCache(paths.candidates, candidates);
  }
  console.log(`${candidates.length} candidate items`);

  // 2. Entities: the cars, then everything they reference (brand, series, classes…),
  //    then the countries of brands and manufacturers.
  const cached = refresh ? null : readCache<Entity[]>(paths.entities);
  const entities = new Map<string, Entity>((cached ?? []).map((e) => [e.id, e]));
  const fetchMissing = async (ids: Iterable<string>, what: string) => {
    const missing = [...new Set(ids)].filter((id) => !entities.has(id));
    if (missing.length === 0) return;
    console.log(`Fetching ${missing.length} ${what}…`);
    for (const e of await getEntities(missing, (n) => process.stdout.write(`\r  ${n}/${missing.length}`))) entities.set(e.id, e);
    process.stdout.write("\n");
    writeCache(paths.entities, [...entities.values()]);
  };
  await fetchMissing(
    candidates.map((c) => c.id),
    "car items",
  );
  const refs = new Set<string>();
  for (const c of candidates) {
    const car = entities.get(c.id);
    for (const p of ["P1716", "P176", "P179", "P31", "P279", "P287", "P1071", "P495", "P516"]) claimIds(car, p).forEach((id) => refs.add(id));
  }
  await fetchMissing(refs, "referenced items");
  const countries = new Set<string>();
  for (const id of refs) for (const p of ["P17", "P495"]) claimIds(entities.get(id), p).forEach((c) => countries.add(c));
  await fetchMissing(countries, "countries");

  // 3. Commons metadata for every main image (and the curated photos).
  const cachedFiles = refresh ? null : readCache<CommonsFileInfo[]>(paths.files);
  const files = new Map<string, CommonsFileInfo>((cachedFiles ?? []).map((f) => [f.title, f]));
  const titles = new Set(extraFiles.map(normalizeFileTitle));
  for (const c of candidates) {
    const image = claimValues(entities.get(c.id), "P18")[0];
    if (typeof image === "string") titles.add(normalizeFileTitle(`File:${image}`));
  }
  const missingFiles = [...titles].filter((t) => !files.has(t));
  if (missingFiles.length > 0) {
    console.log(`Fetching Commons metadata for ${missingFiles.length} files…`);
    for (let i = 0; i < missingFiles.length; i += 50) {
      for (const info of await fetchFileInfos(missingFiles.slice(i, i + 50))) files.set(info.title, info);
      process.stdout.write(`\r  ${Math.min(i + 50, missingFiles.length)}/${missingFiles.length}`);
      // Save progress regularly so an interrupted run resumes where it stopped.
      if ((i / 50) % 10 === 9) writeCache(paths.files, [...files.values()]);
      await sleep(250);
    }
    process.stdout.write("\n");
    writeCache(paths.files, [...files.values()]);
  }

  return { candidates, entities, files };
}
