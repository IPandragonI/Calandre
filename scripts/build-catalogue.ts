// Builds the playable catalogue (public/catalogue.json) from Wikidata + Wikimedia Commons.
//
//   pnpm catalogue [--refresh] [--verify] [--min-sitelinks 5]
//
// 1. fetch   — candidate car items (Wikidata, main image P18, enough Wikipedia articles),
//              referenced brands/classes/series, and Commons licence metadata. Cached in
//              data/catalogue/cache/; --refresh refetches. Photos are never downloaded.
// 2. verify  — (--verify) HEAD request on each accepted image URL, cached for 30 days.
// 3. build   — classification with a reason for every candidate (accepted / review /
//              rejected / duplicate), merge with the curated entries, manual overrides.
// 4. details — Wikipedia intros and Wikidata key facts, sharded in public/details/.
// 5. difficulty — recognisability score from page views, notability, production… and
//              data/catalogue/recognition.json (curated tiers). See catalogue/difficulty.ts.
// Outputs: public/catalogue.json, data/catalogue/decisions.json, data/catalogue/review.html,
// data/catalogue/difficulty.tsv (every score and why),
// data/catalogue/report.json, and a summary on the console. Idempotent: same inputs, same output.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkImageUrl, sleep } from "./lib/commons";
import { buildCatalogue, type CuratedEntry, type Decision, type Override } from "./catalogue/build";
import { writeDetails } from "./catalogue/details";
import { articlesToMeasure, classifyCar, gatherSignals, THRESHOLDS, type CuratedRecognition } from "./catalogue/difficulty";
import { fetchPageviews } from "./catalogue/popularity";
import type { Car } from "../src/types/car";
import { fetchAll } from "./catalogue/fetch";

const path = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? fallback) : fallback);
const readJson = <T>(p: string, fallback: T): T => (existsSync(path(p)) ? (JSON.parse(readFileSync(path(p), "utf8")) as T) : fallback);

const curated = readJson<CuratedEntry[]>("data/catalogue/curated.json", []);
const overrides = readJson<Record<string, Override>>("data/catalogue/overrides.json", {});

const fetched = await fetchAll(path("data/catalogue/cache"), {
  refresh: args.includes("--refresh"),
  minSitelinks: Number(option("--min-sitelinks", "5")),
  extraFiles: curated.map((c) => c.photo.file),
});

// ── Verification cache: url → { status, checkedAt } ────────────────────────────
const VERIFY_CACHE = "data/catalogue/cache/verified.json";
const MONTH = 30 * 24 * 3600 * 1000;
const verifiedCache = readJson<Record<string, { status: number; checkedAt: number }>>(VERIFY_CACHE, {});
const verified = () => Object.fromEntries(Object.entries(verifiedCache).map(([url, v]) => [url, v.status]));

let result = buildCatalogue({ fetched, curated, overrides, verified: verified() });

let rateLimited = false;
if (args.includes("--verify")) {
  // Wikimedia throttles scripted thumbnail requests hard (HTTP 429, Retry-After ≈ 10 min after a
  // few dozen). So: a sample at a time, one request every 2 s, stopping at the first 429.
  // Every file's existence is already confirmed by the Commons API (metadata + thumbnail URL).
  const sampleSize = Number(option("--verify", "150")) || 150;
  const stale = result.cars
    .map((c) => c.image.url)
    .filter((url) => !verifiedCache[url] || Date.now() - verifiedCache[url].checkedAt > MONTH)
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize);
  console.log(`Checking ${stale.length} image URLs (HEAD only, sequential)…`);
  for (const [i, url] of stale.entries()) {
    let status = 0;
    try {
      status = await checkImageUrl(url);
    } catch {
      status = 0;
    }
    if (status === 429) {
      rateLimited = true;
      console.log(`\n  Rate-limited by Wikimedia after ${i} checks: stopping (rerun later to continue).`);
      break;
    }
    // A network error (0) proves nothing about the file: leave it unchecked, try again next run.
    if (status !== 0) verifiedCache[url] = { status, checkedAt: Date.now() };
    process.stdout.write(`\r  ${i + 1}/${stale.length}`);
    await sleep(2000);
  }
  process.stdout.write("\n");
  writeFileSync(path(VERIFY_CACHE), JSON.stringify(verifiedCache));
  result = buildCatalogue({ fetched, curated, overrides, verified: verified() });
}

const { cars, sources, decisions, errors } = result;
/** The Wikidata item behind a car: its own, or the one a curated car matched. */
const itemOf = (car: Car) => car.wikidata ?? sources[car.id];

// ── Details: descriptions and key facts, sharded for the car pages ─────────────
const details = await writeDetails(cars, fetched.entities, { cacheDir: path("data/catalogue/cache"), outDir: path("public/details"), itemOf });

// ── Difficulty: recognisability score and tier for every car ───────────────────
const viewsOf = await fetchPageviews(articlesToMeasure(cars, { entities: fetched.entities, itemOf }), path("data/catalogue/cache/pageviews.json"));
const candidateById = new Map(fetched.candidates.map((c) => [c.id, c]));
const signals = gatherSignals(cars, {
  entities: fetched.entities,
  itemOf,
  views: viewsOf,
  sitelinks: (item) => {
    const row = item ? candidateById.get(item) : undefined;
    return row ? { item: row.sitelinks, series: row.seriesSitelinks } : undefined;
  },
  extracts: {
    fr: readJson<Record<string, string>>("data/catalogue/cache/extracts-fr.json", {}),
    en: readJson<Record<string, string>>("data/catalogue/cache/extracts-en.json", {}),
  },
});
const recognition = readJson<CuratedRecognition>("data/catalogue/recognition.json", {});
const scoreRows: string[] = [];
for (const car of cars) {
  const r = classifyCar(car, signals.get(car.id)!, recognition);
  car.difficulty = r.difficulty;
  car.recognition = r.score;
  scoreRows.push([car.id, `${car.make} ${car.model}${car.generation ? ` (${car.generation})` : ""}`, r.score, r.difficulty, r.why].join("\t"));
}
scoreRows.sort((a, b) => Number(b.split("\t")[2]) - Number(a.split("\t")[2]));
const familyNames = new Set(cars.map((c) => `${c.make} ${c.model}`.toLowerCase()));
const unmatched = Object.values(recognition.models ?? {})
  .flat()
  .filter((name) => !familyNames.has(name.toLowerCase()));
if (unmatched.length > 0) console.log(`recognition.json: no car is named ${unmatched.map((n) => `"${n}"`).join(", ")}`);
writeFileSync(
  path("data/catalogue/difficulty.tsv"),
  `# tiers: easy ≥ ${THRESHOLDS.easy}, medium ≥ ${THRESHOLDS.medium}, hard below; see scripts/catalogue/difficulty.ts\n` +
    `id\tcar\tscore\ttier\twhy\n${scoreRows.join("\n")}\n`,
);
writeFileSync(path("public/catalogue.json"), JSON.stringify(cars));
writeFileSync(path("data/catalogue/decisions.json"), JSON.stringify(decisions, null, 1) + "\n");

// ── Report ──────────────────────────────────────────────────────────────────
const count = (status: Decision["status"]) => decisions.filter((d) => d.status === status).length;
const reasons = (status: Decision["status"]) => {
  const tally = new Map<string, number>();
  for (const d of decisions) {
    if (d.status !== status) continue;
    const key = (d.reason ?? "").replace(/\(.*\)|"[^"]*"/g, "(…)").trim();
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...tally].sort((a, b) => b[1] - a[1]));
};
const byKey = <K extends string>(key: (c: (typeof cars)[number]) => K) =>
  cars.reduce<Record<string, number>>((acc, c) => ({ ...acc, [key(c)]: (acc[key(c)] ?? 0) + 1 }), {});
const verifiedUrls = cars.filter((c) => verifiedCache[c.image.url]?.status === 200).length;
const report = {
  generatedFrom: { candidates: fetched.candidates.length, curated: curated.length },
  candidates: {
    accepted: count("accepted"),
    review: count("review"),
    rejected: count("rejected"),
    duplicate: count("duplicate"),
  },
  playable: {
    total: cars.length,
    curated: cars.filter((c) => !c.wikidata).length,
    imported: cars.filter((c) => c.wikidata).length,
    byDifficulty: byKey((c) => String(c.difficulty)),
    byRegion: byKey((c) => c.region),
    withYears: cars.filter((c) => c.years).length,
    withBodyType: cars.filter((c) => c.bodyType).length,
    withClue: cars.filter((c) => c.clue).length,
    withGeneration: cars.filter((c) => c.generation).length,
  },
  details: { withDescription: details.withDescription, withFacts: details.withFacts },
  images: {
    verifiedOk: verifiedUrls,
    /** Checked and broken: these were rejected from the catalogue. */
    brokenRejected: decisions.filter((d) => d.reason?.startsWith("image unavailable")).length,
    notChecked: cars.filter((c) => !verifiedCache[c.image.url]).length,
    lastRunRateLimited: rateLimited,
  },
  reviewReasons: reasons("review"),
  rejectionReasons: reasons("rejected"),
  duplicateReasons: reasons("duplicate"),
  errors,
};
writeFileSync(path("data/catalogue/report.json"), JSON.stringify(report, null, 2) + "\n");

// ── Review page: remote thumbnails only, nothing downloaded ─────────────────────
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const review = decisions.filter((d) => d.status === "review");
writeFileSync(
  path("data/catalogue/review.html"),
  `<!doctype html><meta charset="utf-8"><title>Calandre — review queue (${review.length})</title>
<style>body{font:14px system-ui;margin:16px}ul{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;list-style:none;padding:0}
li{border:1px solid #ccc;border-radius:8px;padding:8px}img{width:100%;aspect-ratio:16/10;object-fit:cover;background:#eee}code{font-size:12px}</style>
<h1>Review queue: ${review.length} candidates</h1>
<p>Approve or reject in <code>data/catalogue/overrides.json</code>, e.g. <code>{"Q123": {"status": "accept"}}</code>, then rerun <code>pnpm catalogue</code>.</p>
<ul>${review
    .map(
      (d) => `<li>${d.thumbUrl ? `<img loading="lazy" src="${escape(d.thumbUrl)}" alt="">` : ""}
<p><b>${escape(d.label)}</b> <code>${d.id}</code><br>${escape(d.reason ?? "")}${
        d.proposed ? `<br>→ ${escape(`${d.proposed.make} · ${d.proposed.model}${d.proposed.generation ? ` · ${d.proposed.generation}` : ""}`)}` : ""
      }<br>${d.sourcePage ? `<a href="${escape(d.sourcePage)}">${escape(d.file ?? "file")}</a>` : ""}</p></li>`,
    )
    .join("\n")}</ul>`,
);

console.log(`
Catalogue built: ${cars.length} playable cars (${report.playable.curated} curated + ${report.playable.imported} imported)
Candidates: ${fetched.candidates.length} · accepted ${report.candidates.accepted} · review ${report.candidates.review} · rejected ${report.candidates.rejected} · duplicates ${report.candidates.duplicate}
Images HEAD-checked OK: ${verifiedUrls} · broken (rejected): ${report.images.brokenRejected} · not checked: ${report.images.notChecked}
Descriptions: ${details.withDescription} · key facts: ${details.withFacts}
Details: data/catalogue/report.json · review queue: data/catalogue/review.html`);
if (errors.length > 0) console.error(`\n${errors.length} errors:\n${errors.join("\n")}`);
