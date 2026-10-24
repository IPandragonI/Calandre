/**
 * Calandre's emblem: a chrome swan mascot, redrawn as a vector from the reference
 * artwork (swann.png) — S-curved neck with the head bowed, a layered wing swept back
 * like a hood ornament's, and a long streamlined hull. 150×100 viewBox.
 * Shared by the React logo and the icon generator (scripts/generate-icons.ts).
 */
export const SWAN_VIEWBOX = "0 0 150 100";

/** Four feather blades fanning from the shoulder (full mark). */
export const SWAN_FEATHERS = [
  "M6 6 Q61.5 16.5 101 57 Q56.3 26.2 6 6 Z",
  "M24 21 Q68 27.2 98 60 Q63.3 36.1 24 21 Z",
  "M41 33 Q74.2 36.3 95 62.5 Q69.9 44.2 41 33 Z",
  "M57 44 Q79.9 45.5 92 65 Q76 51.9 57 44 Z",
];

/** Two broader blades for small sizes, where four would blur together. */
export const SWAN_FEATHERS_SMALL = ["M8 8 Q62.4 17.5 101 57 Q57.3 27.2 8 8 Z", "M34 30 Q71 34.4 96 62 Q66.8 42.4 34 30 Z"];

/** Hull, S-neck and bowed head. */
export const SWAN_BODY =
  "M14 91 C 48 85, 82 73, 98 60 C 102.5 52, 102.5 39, 104.5 29.5 C 106.5 19, 115 13.5, 122 15 " +
  "C 128.5 16.5, 132.5 24, 134.8 39 L 135.8 46.5 L 132.6 41.8 C 130.3 32.5, 127.2 26.8, 122.7 25.8 " +
  "C 117.2 24.8, 114.2 30.2, 114.2 38 C 114.2 49, 122 57.5, 127.6 65.5 C 134 74.5, 131 87.5, 112 88.5 " +
  "C 80 89.5, 46 90.5, 14 91 Z";

/** Eye, cut out of the head (even-odd); omitted at small sizes. */
export const SWAN_EYE = "M132.3 31 a1.1 1.1 0 1 0 -2.2 0 a1.1 1.1 0 1 0 2.2 0 Z";

/** Standalone SVG paths, e.g. for icons. `fill` may be a colour or a gradient url(). */
export function swanSvgPaths(fill: string, { small = false }: { small?: boolean } = {}): string {
  const feathers = small ? SWAN_FEATHERS_SMALL : SWAN_FEATHERS;
  return [
    ...feathers.map((d) => `<path d="${d}" fill="${fill}"/>`),
    `<path d="${SWAN_BODY}${small ? "" : ` ${SWAN_EYE}`}" fill="${fill}" fill-rule="evenodd"/>`,
  ].join("");
}
