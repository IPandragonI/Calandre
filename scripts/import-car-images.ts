// Step 1 of dataset maintenance: collect candidate photos for a list of target cars.
//
//   pnpm dataset:import [--only id1,id2] [--refresh] [--sheets]
//
// Reads data/car-targets.json, queries Wikidata (main image, P18) and Commons search,
// fetches each file's licensing metadata and writes data/review/candidates.json.
// Resumable: cars already in candidates.json are skipped unless --refresh (or --only).
// Nothing is accepted automatically: a human picks the right file per car in
// data/review/approved.json, then runs `pnpm dataset:bundle`.
// --sheets also renders numbered contact sheets (data/review/sheets/*.png) to review visually.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { download, fetchFileInfos, searchCommonsFiles, searchWikidata, sleep, type CommonsFileInfo } from "./lib/commons";

interface Target {
  id: string;
  /** Wikidata search string; the entity's P18 image becomes a candidate. */
  wikidata: string;
  /** Commons full-text search string for extra candidates. */
  commons: string;
}

interface Candidate extends CommonsFileInfo {
  origin: string;
}

interface CandidateSet {
  id: string;
  status: "pending";
  wikidataHits: { id: string; label: string; description: string }[];
  candidates: Candidate[];
}

const path = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const args = process.argv.slice(2);
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1]?.split(",")) : null;
const withSheets = args.includes("--sheets");

const refresh = args.includes("--refresh");
const outFile = path("data/review/candidates.json");

const targets = (JSON.parse(readFileSync(path("data/car-targets.json"), "utf8")) as Target[]).filter(
  (t) => !only || only.has(t.id),
);

// Resumable: cars already collected are kept unless --refresh or --only names them.
mkdirSync(path("data/review/"), { recursive: true });
const previous: CandidateSet[] = existsSync(outFile) ? JSON.parse(readFileSync(outFile, "utf8")) : [];
const results = new Map(previous.map((set) => [set.id, set]));
const save = () => writeFileSync(outFile, JSON.stringify([...results.values()], null, 2) + "\n");

for (const target of targets) {
  if (results.has(target.id) && !refresh && !only) continue;
  const hits = await searchWikidata(target.wikidata);
  const commonsTitles = await searchCommonsFiles(target.commons);
  const origins = new Map<string, string>();
  for (const hit of hits) if (hit.imageFile) origins.set(hit.imageFile, `wikidata:${hit.id} (${hit.label})`);
  for (const title of commonsTitles) if (!origins.has(title)) origins.set(title, "commons-search");

  const infos = await fetchFileInfos([...origins.keys()]);
  const candidates = infos
    .map((info) => ({ ...info, origin: origins.get(info.title) ?? "unknown" }))
    // Landscape photos only: the game frame is 16:10.
    .filter((c) => c.width >= 1000 && c.width > c.height);
  const set: CandidateSet = {
    id: target.id,
    status: "pending",
    wikidataHits: hits.map(({ id, label, description }) => ({ id, label, description })),
    candidates,
  };
  results.set(target.id, set);
  save();
  console.log(
    `${target.id}: ${candidates.length} candidates (${candidates.filter((c) => c.licenseAllowed).length} with an allowed license)`,
  );
  if (withSheets) await renderSheet(set);
  await sleep(1500);
}

console.log(`\n${results.size} candidate sets in ${outFile}`);

/** One PNG per car: allowed-license candidates side by side, numbered for review. */
async function renderSheet(set: CandidateSet) {
  mkdirSync(path("data/review/sheets/"), { recursive: true });
  const TILE_W = 320;
  const TILE_H = 200;
  const usable = set.candidates.filter((c) => c.licenseAllowed).slice(0, 6);
  if (usable.length === 0) return;
  const tiles: Buffer[] = [];
  for (const [i, c] of usable.entries()) {
    try {
      const img = await sharp(await download(c.thumbUrl)).resize(TILE_W, TILE_H, { fit: "cover" }).toBuffer();
      const label = Buffer.from(
        `<svg width="${TILE_W}" height="${TILE_H}"><rect width="34" height="26" fill="#000"/><text x="8" y="19" font-size="18" font-family="sans-serif" fill="#fff">${i}</text></svg>`,
      );
      tiles.push(await sharp(img).composite([{ input: label }]).png().toBuffer());
    } catch (error) {
      console.warn(`  ${set.id} #${i}: thumbnail failed (${String(error)})`);
      tiles.push(await sharp({ create: { width: TILE_W, height: TILE_H, channels: 3, background: "#600" } }).png().toBuffer());
    }
    await sleep(150);
  }
  await sharp({ create: { width: TILE_W * tiles.length, height: TILE_H, channels: 3, background: "#222" } })
    .composite(tiles.map((input, i) => ({ input, left: i * TILE_W, top: 0 })))
    .png()
    .toFile(path(`data/review/sheets/${set.id}.png`));
}
