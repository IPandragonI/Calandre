// Builds the PWA icons and the SVG favicon from one vector mark (a stylised grille).
// Usage: pnpm icons
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const path = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const INK = "#17181b";
const PAPER = "#f7f5f0";
const ORANGE = "#f47634";

/** The grille mark on a 100×100 canvas, scaled by `scale` around the centre. */
function mark(scale) {
  const t = `translate(50 50) scale(${scale}) translate(-50 -50)`;
  return `<g transform="${t}">
    <rect x="12" y="25" width="76" height="50" rx="17" fill="none" stroke="${PAPER}" stroke-width="7"/>
    <rect x="26" y="37" width="48" height="6" rx="3" fill="${PAPER}"/>
    <rect x="26" y="47" width="48" height="6" rx="3" fill="${ORANGE}"/>
    <rect x="26" y="57" width="48" height="6" rx="3" fill="${PAPER}"/>
  </g>`;
}

/** Rounded tile for regular icons; full-bleed with a smaller mark for maskable ones. */
const svg = ({ rounded, scale }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" ${rounded ? 'rx="22"' : ""} fill="${INK}"/>
    ${mark(scale)}
  </svg>`;

const render = (source, size) => sharp(Buffer.from(source)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

mkdirSync(path("public/icons"), { recursive: true });
const regular = svg({ rounded: true, scale: 1 });
// Maskable icons keep the artwork inside the central 80% safe zone.
const maskable = svg({ rounded: false, scale: 0.72 });
// Apple applies its own corner mask, so the tile is square.
const apple = svg({ rounded: false, scale: 0.85 });

writeFileSync(path("public/icons/icon-192.png"), await render(regular, 192));
writeFileSync(path("public/icons/icon-512.png"), await render(regular, 512));
writeFileSync(path("public/icons/icon-maskable-512.png"), await render(maskable, 512));
writeFileSync(path("public/icons/apple-touch-icon.png"), await render(apple, 180));
writeFileSync(path("src/app/icon.svg"), regular.replace(/\s+/g, " ").trim() + "\n");
console.log("Icons written to public/icons and src/app/icon.svg");
