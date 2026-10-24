// Build phase: turns fetched Wikidata/Commons data + curated entries into the playable catalogue.
// Pure (no network): every decision is recorded with a reason.
import type { Car, CarTag, Localized } from "../../src/types/car";
import { acceptedAnswersFor, modelKey, normalizeAnswer } from "../../src/lib/game/answer-validation";
import { carProblem } from "../../src/lib/data/dataset";
import type { CommonsFileInfo } from "../lib/commons";
import { claimIds, claimValues, claimYear, label, type Entity } from "../lib/wikidata";
import type { FetchedData } from "./fetch";
import { normalizeFileTitle } from "./fetch";
import { classify, cleanMake, difficultyFor, fileExclusion, fileNamesModel, parseName, photoProblem, regionOf } from "./rules";

export type Status = "accepted" | "review" | "rejected" | "duplicate";

export interface Decision {
  id: string;
  label: string;
  status: Status;
  reason?: string;
  file?: string;
  sourcePage?: string;
  thumbUrl?: string;
  sitelinks: number;
  proposed?: { make: string; model: string; generation?: string };
}

export interface Override {
  status?: "accept" | "reject";
  note?: string;
  make?: string;
  model?: string;
  generation?: string | null;
  position?: string;
}

export interface CuratedEntry extends Omit<Car, "image"> {
  photo: { file: string; position?: string };
}

export interface BuildInput {
  fetched: FetchedData;
  curated: CuratedEntry[];
  overrides: Record<string, Override>;
  /** HTTP status of image URLs checked with --verify (missing = not checked). */
  verified: Record<string, number>;
}

export interface BuildResult {
  cars: Car[];
  decisions: Decision[];
  errors: string[];
}

const CLASSIC_UNTIL = 1985;

/** Commons appends tracking parameters to image URLs; the stable path is enough. */
export function cleanImageUrl(url: string): string {
  return url.replace(/[?#].*$/, "");
}

function imageOf(info: CommonsFileInfo, position?: string): Car["image"] {
  return {
    url: cleanImageUrl(info.url),
    width: info.width,
    height: info.height,
    ...(position ? { position } : {}),
    sourcePage: info.sourcePage,
    author: info.author,
    license: info.license,
    licenseUrl: info.licenseUrl,
  };
}

function thumb(raw: string): string {
  const url = cleanImageUrl(raw);
  return url.includes("/thumb/") ? url.replace(/\/\d+px-([^/]+)$/, "/330px-$1") : url;
}

export function buildCatalogue({ fetched, curated, overrides, verified }: BuildInput): BuildResult {
  const { entities, files } = fetched;
  const errors: string[] = [];
  const decisions: Decision[] = [];
  const get = (id: string | undefined) => (id ? entities.get(id) : undefined);
  const labelOf = (id: string | undefined, lang: "fr" | "en") => label(get(id), lang) ?? label(get(id), lang === "fr" ? "en" : "fr");
  const countryOf = (e: Entity | undefined): string | null => {
    for (const p of ["P17", "P495"]) {
      for (const countryId of claimIds(e, p)) {
        const iso = claimValues(get(countryId), "P297")[0];
        if (typeof iso === "string" && /^[A-Z]{2}$/.test(iso)) return iso;
      }
    }
    return null;
  };

  // ── Curated entries (hand-written clues and facts) ───────────────────────
  const cars: Car[] = [];
  const takenFiles = new Set<string>();
  const takenNames = new Set<string>();
  const nameKey = (c: Pick<Car, "make" | "model" | "generation">) => normalizeAnswer(`${c.make} ${c.model} ${c.generation ?? ""}`).split(" ").sort().join(" ");
  for (const entry of curated) {
    const { photo, ...car } = entry;
    const file = normalizeFileTitle(photo.file);
    const info = files.get(file);
    if (!info) {
      errors.push(`curated ${car.id}: no Commons metadata for ${file}`);
      continue;
    }
    if (!info.licenseAllowed) {
      errors.push(`curated ${car.id}: license "${info.license}" not allowed`);
      continue;
    }
    const full: Car = { ...car, image: imageOf(info, photo.position) };
    const problem = carProblem(full);
    if (problem) {
      errors.push(`curated ${car.id}: ${problem}`);
      continue;
    }
    cars.push(full);
    takenFiles.add(file);
    takenNames.add(nameKey(full));
    for (const a of acceptedAnswersFor(full)) if (a.precise || !full.generation) takenNames.add(a.normalized.split(" ").sort().join(" "));
  }

  // ── Wikidata candidates ───────────────────────────────────────────────────
  interface Accepted {
    car: Car;
    file: string;
    series: string | null;
    sitelinks: number;
    decision: Decision;
  }
  const accepted: Accepted[] = [];

  for (const row of fetched.candidates) {
    const entity = get(row.id);
    const override = overrides[row.id] ?? {};
    const name = label(entity, "en") ?? label(entity, "fr") ?? row.id;
    const decision: Decision = { id: row.id, label: name, status: "rejected", sitelinks: row.sitelinks };
    decisions.push(decision);
    const reject = (reason: string, status: Status = "rejected") => {
      decision.status = status;
      decision.reason = reason;
    };

    if (!entity) {
      reject("entity not fetched");
      continue;
    }
    if (override.status === "reject") {
      reject(`manual: ${override.note ?? "rejected"}`);
      continue;
    }
    const p18 = claimValues(entity, "P18")[0];
    const file = typeof p18 === "string" ? normalizeFileTitle(`File:${p18}`) : null;
    const info = file ? files.get(file) : undefined;
    if (!file || !info) {
      reject("no image metadata");
      continue;
    }
    decision.file = file;
    decision.sourcePage = info.sourcePage;
    decision.thumbUrl = thumb(info.url);

    const photo = photoProblem(info);
    if (photo) {
      reject(photo);
      continue;
    }
    const excludedWord = fileExclusion(file);
    if (excludedWord && override.status !== "accept") {
      reject(`detail or non-car photo ("${excludedWord}" in file name)`);
      continue;
    }
    const status = verified[cleanImageUrl(info.url)];
    if (status !== undefined && status !== 200) {
      reject(`image unavailable (HTTP ${status})`);
      continue;
    }

    const classLabels = [...claimIds(entity, "P31"), ...claimIds(entity, "P279")]
      .map((id) => labelOf(id, "en"))
      .filter((l): l is string => Boolean(l));
    const { bodyType, tags, excludedBy } = classify(classLabels);
    if (excludedBy) {
      reject(`not a car for the game (${excludedBy})`);
      continue;
    }

    const brandIds = claimIds(entity, "P1716");
    const makerIds = claimIds(entity, "P176");
    const makes = [...brandIds, ...makerIds]
      .flatMap((id) => [labelOf(id, "en"), labelOf(id, "fr")])
      .filter((l): l is string => Boolean(l))
      .map(cleanMake);
    const seriesId = claimIds(entity, "P179")[0] ?? null;
    const seriesLabel = seriesId ? labelOf(seriesId, "en") : null;
    let parsed = parseName(name, makes, seriesLabel) ?? (label(entity, "fr") ? parseName(label(entity, "fr")!, makes, seriesLabel) : null);
    if (override.make && override.model) {
      parsed = { make: override.make, model: override.model, ...(override.generation ? { generation: override.generation } : {}) };
    }
    if (!parsed) {
      reject(makes.length === 0 ? "no brand or manufacturer" : "label does not start with the brand", "review");
      continue;
    }
    if (override.generation === null) delete parsed.generation;
    if (parsed.model.length > 40 || (parsed.generation?.length ?? 0) > 30) {
      reject("name too long to be an answer", "review");
      continue;
    }
    decision.proposed = parsed;

    const country = countryOf(get(brandIds[0])) ?? countryOf(get(makerIds[0])) ?? countryOf(entity);
    if (!country) {
      reject("unknown country of origin", "review");
      continue;
    }

    const from = claimYear(entity, ["P580", "P571", "P729"]);
    const toRaw = claimYear(entity, ["P582", "P2669", "P730"]);
    const years = from ? { from, to: toRaw !== null && toRaw >= from ? toRaw : null } : undefined;
    const allTags = new Set<CarTag>(tags);
    if (years && years.from <= CLASSIC_UNTIL) allTags.add("classic");

    if (!fileNamesModel(file, parsed) && override.status !== "accept") {
      reject("file name does not name the model (identity not confirmed)", "review");
      continue;
    }

    // Distinctive clue from structured data only: designer, else assembly site.
    const designer = claimIds(entity, "P287").map((id) => labelOf(id, "en")).find(Boolean);
    const siteFr = claimIds(entity, "P1071").map((id) => labelOf(id, "fr")).find(Boolean);
    const siteEn = claimIds(entity, "P1071").map((id) => labelOf(id, "en")).find(Boolean);
    const clue: Localized | undefined = designer
      ? { fr: `Dessinée par ${designer}.`, en: `Designed by ${designer}.` }
      : siteFr && siteEn
        ? { fr: `Lieu d'assemblage : ${siteFr}.`, en: `Assembled at: ${siteEn}.` }
        : undefined;

    const aliases = [
      ...(entity.aliases?.en ?? []),
      ...(entity.aliases?.fr ?? []),
      ...(label(entity, "fr") && label(entity, "fr") !== name ? [{ value: label(entity, "fr")! }] : []),
      { value: name },
    ]
      .map((a) => a.value.trim())
      .filter((a) => {
        const n = normalizeAnswer(a);
        const words = n.split(" ");
        const modelWords = normalizeAnswer(`${parsed.model} ${parsed.generation ?? ""}`).split(" ");
        return n.length > 0 && n.length <= 50 && words.length <= 6 && words.some((w) => modelWords.includes(w));
      });

    const links: Partial<Localized> = {};
    if (entity.sitelinks?.frwiki?.url) links.fr = entity.sitelinks.frwiki.url;
    if (entity.sitelinks?.enwiki?.url) links.en = entity.sitelinks.enwiki.url;

    const finalTags = [...allTags];
    const car: Car = {
      id: row.id.toLowerCase(),
      make: parsed.make,
      model: parsed.model,
      ...(parsed.generation ? { generation: parsed.generation } : {}),
      ...(years ? { years } : {}),
      country,
      region: regionOf(country),
      ...(bodyType ? { bodyType } : {}),
      tags: finalTags,
      difficulty: difficultyFor(row.sitelinks, row.seriesSitelinks, finalTags),
      acceptedAnswers: [...new Set(aliases)],
      ...(clue ? { clue } : {}),
      wikidata: row.id,
      ...(Object.keys(links).length > 0 ? { links } : {}),
      image: imageOf(info, override.position),
    };
    const problem = carProblem(car);
    if (problem) {
      reject(`invalid entry (${problem})`);
      continue;
    }
    decision.status = "accepted";
    decision.reason = override.status === "accept" ? "manual: accepted" : undefined;
    accepted.push({ car, file, series: seriesId, sitelinks: row.sitelinks, decision });
  }

  // ── Duplicates ────────────────────────────────────────────────────────────
  const markDuplicate = (a: Accepted, reason: string) => {
    a.decision.status = "duplicate";
    a.decision.reason = reason;
  };
  // A model family whose generations are in the catalogue is covered by them.
  const seriesInUse = new Set(accepted.map((a) => a.series).filter((s): s is string => s !== null));
  for (const a of accepted) if (seriesInUse.has(a.car.wikidata!)) markDuplicate(a, "model family covered by its generations");

  // Most specific (named generation), then most notable, first.
  const ranked = accepted
    .filter((a) => a.decision.status === "accepted")
    .sort((x, y) => Number(Boolean(y.car.generation)) - Number(Boolean(x.car.generation)) || y.sitelinks - x.sitelinks || (x.car.id < y.car.id ? -1 : 1));
  const curatedByName = new Map(cars.map((c) => [nameKey(c), c]));
  const curatedByFile = new Map(cars.map((c) => [normalizeFileTitle(`File:${decodeURIComponent(c.image.sourcePage.split("File:")[1] ?? "")}`), c]));
  for (const a of ranked) {
    const key = nameKey(a.car);
    if (takenFiles.has(a.file)) {
      markDuplicate(a, "same photo as another entry");
      const curatedCar = curatedByFile.get(a.file);
      if (curatedCar && !curatedCar.links && a.car.links) curatedCar.links = a.car.links;
    } else if (takenNames.has(key)) {
      markDuplicate(a, "same car as another entry");
      // A curated car learns its Wikipedia articles from the matching Wikidata item.
      const curatedCar = curatedByName.get(key);
      if (curatedCar && !curatedCar.links && a.car.links) curatedCar.links = a.car.links;
    }
    else {
      takenFiles.add(a.file);
      takenNames.add(key);
      cars.push(a.car);
    }
  }

  // ── Aliases claimed by two different models are dropped from both ─────────
  const owners = new Map<string, Set<string>>();
  for (const car of cars) {
    // Base names count too: an alias may not be another model's own name.
    const base = [`${car.make} ${car.model}`, `${car.make} ${car.model} ${car.generation ?? ""}`];
    for (const alias of [...base, ...car.acceptedAnswers]) {
      const key = normalizeAnswer(alias).split(" ").sort().join(" ");
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key)!.add(modelKey(car));
    }
  }
  for (const car of cars) {
    car.acceptedAnswers = car.acceptedAnswers.filter((alias) => (owners.get(normalizeAnswer(alias).split(" ").sort().join(" "))?.size ?? 0) <= 1);
  }

  cars.sort((a, b) => (a.id < b.id ? -1 : 1));
  return { cars, decisions, errors };
}
