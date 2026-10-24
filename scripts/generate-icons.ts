// Builds the PWA icons and the SVG favicon from the swan mascot.
// Usage: pnpm icons
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { swanSvgPaths } from "../src/lib/brand/ornament";

const path = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const INK = "#16171b";

/** Polished chrome, kept restrained: a three-stop silver gradient, no glow or bevel. */
const CHROME = `<linearGradient id="chrome" x1="0" y1="0" x2="0.4" y2="1">
  <stop offset="0" stop-color="#fbfaf7"/><stop offset="0.55" stop-color="#d9d6cf"/><stop offset="1" stop-color="#a9a59c"/></linearGradient>`;

/** Swan bounding box in its 150×100 viewBox. */
const BOX = { x: 6, y: 6, w: 130, h: 85 };

/** The swan centred on a 100×100 tile; `scale` is its width relative to the tile. */
function tile({ rounded, scale, metallic, small = false }: { rounded: boolean; scale: number; metallic: boolean; small?: boolean }) {
  const s = (100 * scale) / BOX.w;
  const cx = BOX.x + BOX.w / 2;
  const cy = BOX.y + BOX.h / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>${CHROME}</defs>
    <rect width="100" height="100" ${rounded ? 'rx="22"' : ""} fill="${INK}"/>
    <g transform="translate(50 52) scale(${s}) translate(${-cx} ${-cy})">${swanSvgPaths(metallic ? "url(#chrome)" : "#eceae4", { small })}</g>
  </svg>`;
}

const render = (svg: string, size: number) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

mkdirSync(path("public/icons"), { recursive: true });
const regular = tile({ rounded: true, scale: 0.8, metallic: true });
// Maskable icons keep the artwork inside the central safe zone.
const maskable = tile({ rounded: false, scale: 0.62, metallic: true });
// Apple applies its own corner mask, so the tile is square.
const apple = tile({ rounded: false, scale: 0.72, metallic: true });
// The favicon is flat and simplified: gradients and fine feathers turn to mush at 16 px.
const favicon = tile({ rounded: true, scale: 0.9, metallic: false, small: true });

writeFileSync(path("public/icons/icon-192.png"), await render(regular, 192));
writeFileSync(path("public/icons/icon-512.png"), await render(regular, 512));
writeFileSync(path("public/icons/icon-maskable-512.png"), await render(maskable, 512));
writeFileSync(path("public/icons/apple-touch-icon.png"), await render(apple, 180));
writeFileSync(path("src/app/icon.svg"), favicon.replace(/\s+/g, " ").trim() + "\n");
console.log("Icons written to public/icons and src/app/icon.svg");
