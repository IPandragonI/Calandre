// Step 2 of dataset maintenance: build the production dataset from reviewed entries.
//
//   pnpm dataset:bundle
//
// Reads data/cars.source.json (editorial content + the manually approved Commons file
// in `photo.file`), re-fetches each file's licensing metadata, refuses anything without
// an allowed free license, downloads the photo once, writes two WebP renditions under
// an opaque name (so the file name doesn't give the answer away) and generates
// src/data/cars.json. Entries without an approved photo are left out of the game.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { download, fetchFileInfos, sleep, type CommonsFileInfo } from "./lib/commons";
import { carProblem, carName } from "../src/lib/data/dataset";
import type { Car } from "../src/types/car";

type SourceEntry = Omit<Car, "image"> & {
  photo?: {
    /** "File:Name.jpg" on Wikimedia Commons, chosen by a human reviewer. */
    file: string;
    /** CSS object-position when the car isn't centred. */
    position?: string;
  };
};

const path = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const OUT_DIR = path("public/cars/");
const WIDTHS = [640, 1200] as const;

const source = JSON.parse(readFileSync(path("data/cars.source.json"), "utf8")) as SourceEntry[];
const approved = source.filter((entry) => entry.photo?.file);

const infos = new Map<string, CommonsFileInfo>();
const titles = [...new Set(approved.map((e) => e.photo!.file))];
for (let i = 0; i < titles.length; i += 40) {
  for (const info of await fetchFileInfos(titles.slice(i, i + 40), 1600)) infos.set(info.title, info);
  await sleep(500);
}

mkdirSync(OUT_DIR, { recursive: true });
const cars: Car[] = [];
const keep = new Set<string>();
for (const entry of approved) {
  const { photo, ...car } = entry;
  const file = photo!.file.replace(/_/g, " ");
  const info = infos.get(file);
  if (!info) {
    console.error(`✗ ${car.id}: ${file} not found on Commons`);
    continue;
  }
  if (!info.licenseAllowed) {
    console.error(`✗ ${car.id}: license "${info.license}" is not allowed`);
    continue;
  }

  const name = createHash("sha256").update(`${car.id}|${file}`).digest("hex").slice(0, 12);
  const targets = WIDTHS.map((w) => `${OUT_DIR}${name}-${w}.webp`);
  if (!targets.every(existsSync)) {
    const original = await download(info.thumbUrl);
    for (const [i, width] of WIDTHS.entries()) {
      await sharp(original)
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: width === 640 ? 70 : 74, effort: 6 })
        .toFile(targets[i]);
    }
    await sleep(400);
  }
  WIDTHS.forEach((w) => keep.add(`${name}-${w}.webp`));
  const meta = await sharp(targets[1]).metadata();

  const label = carName(car);
  const full: Car = {
    ...car,
    image: {
      src: `/cars/${name}`,
      width: meta.width ?? 1200,
      height: meta.height ?? 800,
      ...(photo!.position ? { position: photo!.position } : {}),
      alt: { fr: `Photo de la ${label}`, en: `Photo of the ${label}` },
      sourcePage: info.sourcePage,
      author: info.author,
      license: info.license,
      licenseUrl: info.licenseUrl,
    },
  };
  const problem = carProblem(full);
  if (problem) {
    console.error(`✗ ${car.id}: ${problem}`);
    continue;
  }
  cars.push(full);
  console.log(`✓ ${car.id} — ${info.license} — ${info.author}`);
}

for (const fileName of readdirSync(OUT_DIR)) {
  if (!keep.has(fileName)) rmSync(`${OUT_DIR}${fileName}`);
}

writeFileSync(path("src/data/cars.json"), JSON.stringify(cars, null, 2) + "\n");
const skipped = source.length - cars.length;
console.log(`\n${cars.length} cars written to src/data/cars.json${skipped ? ` (${skipped} without an approved photo)` : ""}.`);
