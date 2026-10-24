// Wikimedia Commons / Wikidata helpers for the dataset maintenance scripts.
// Never imported by the app: gameplay only reads the bundled dataset.

const USER_AGENT = "CalandreDatasetBuilder/1.0 (offline car quiz; dataset maintenance script)";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

export interface CommonsFileInfo {
  /** "File:Name.jpg" */
  title: string;
  sourcePage: string;
  /** Original file URL. */
  url: string;
  /** Thumbnail URL at the requested width. */
  thumbUrl: string;
  width: number;
  height: number;
  author: string;
  license: string;
  licenseUrl: string | null;
  credit: string;
  attributionRequired: boolean;
  licenseAllowed: boolean;
}

/**
 * Licenses we can redistribute with attribution. Anything else (unknown, fair use,
 * non-commercial, GFDL-only…) is rejected and must not enter the dataset.
 */
const ALLOWED_LICENSE = /^(cc0( 1\.0)?|public domain|pd(-[\w-]+)?|cc by(-sa)? \d\.\d( [a-z-]+)?)$/i;

export function isAllowedLicense(shortName: string): boolean {
  return ALLOWED_LICENSE.test(shortName.trim());
}

/** Strips the HTML Commons returns in extmetadata fields. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    } catch (error) {
      // Network hiccup (timeout, reset): retry a few times before giving up.
      if (attempt >= 4) throw error;
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (res.ok) return res;
    if (attempt >= 6 || (res.status !== 429 && res.status < 500)) {
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
    // Wikimedia asks clients to honour Retry-After when throttled.
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000 * (attempt + 1));
  }
}

export async function getJson<T>(url: string): Promise<T> {
  return (await (await fetchWithRetry(url)).json()) as T;
}

export async function download(url: string): Promise<Buffer> {
  return Buffer.from(await (await fetchWithRetry(url)).arrayBuffer());
}

interface ImageInfoResponse {
  query?: {
    pages?: Record<
      string,
      {
        title: string;
        missing?: string;
        imageinfo?: {
          url: string;
          thumburl?: string;
          width: number;
          height: number;
          descriptionurl: string;
          extmetadata?: Record<string, { value: string } | undefined>;
        }[];
      }
    >;
  };
}

/** Fetches licensing metadata for up to 50 Commons files in one request. */
export async function fetchFileInfos(titles: string[], thumbWidth = 480): Promise<CommonsFileInfo[]> {
  if (titles.length === 0) return [];
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: String(thumbWidth),
    titles: titles.join("|"),
  });
  const data = await getJson<ImageInfoResponse>(`${COMMONS_API}?${params}`);
  const out: CommonsFileInfo[] = [];
  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    if (page.missing !== undefined || !info) continue;
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? "unknown");
    out.push({
      title: page.title,
      sourcePage: info.descriptionurl,
      url: info.url,
      thumbUrl: info.thumburl ?? info.url,
      width: info.width,
      height: info.height,
      author: stripHtml(meta.Artist?.value ?? "") || "Unknown",
      license,
      licenseUrl: meta.LicenseUrl?.value ?? null,
      credit: stripHtml(meta.Credit?.value ?? ""),
      attributionRequired: meta.AttributionRequired?.value !== "false",
      licenseAllowed: isAllowedLicense(license),
    });
  }
  return out;
}

interface SearchResponse {
  search: { id: string }[];
}
interface EntitiesResponse {
  entities: Record<
    string,
    {
      labels?: Record<string, { value: string }>;
      descriptions?: Record<string, { value: string }>;
      claims?: Record<string, { mainsnak: { datavalue?: { value: unknown } } }[]>;
    }
  >;
}

export interface WikidataHit {
  id: string;
  label: string;
  description: string;
  imageFile: string | null;
}

/** Searches Wikidata and returns the top hits with their main image (P18), if any. */
export async function searchWikidata(query: string, limit = 3): Promise<WikidataHit[]> {
  const search = await getJson<SearchResponse>(
    `${WIKIDATA_API}?${new URLSearchParams({ action: "wbsearchentities", search: query, language: "en", format: "json", limit: String(limit) })}`,
  );
  const ids = search.search.map((s) => s.id);
  if (ids.length === 0) return [];
  const entities = await getJson<EntitiesResponse>(
    `${WIKIDATA_API}?${new URLSearchParams({ action: "wbgetentities", ids: ids.join("|"), props: "labels|descriptions|claims", languages: "en", format: "json" })}`,
  );
  return ids.map((id) => {
    const e = entities.entities[id];
    const image = e?.claims?.P18?.[0]?.mainsnak.datavalue?.value;
    return {
      id,
      label: e?.labels?.en?.value ?? id,
      description: e?.descriptions?.en?.value ?? "",
      imageFile: typeof image === "string" ? `File:${image}` : null,
    };
  });
}

interface CommonsSearchResponse {
  query?: { search: { title: string }[] };
}

/** Full-text search in the Commons File: namespace, bitmaps only. */
export async function searchCommonsFiles(query: string, limit = 6): Promise<string[]> {
  const data = await getJson<CommonsSearchResponse>(
    `${COMMONS_API}?${new URLSearchParams({ action: "query", list: "search", srnamespace: "6", srsearch: `${query} filetype:bitmap`, srlimit: String(limit), format: "json" })}`,
  );
  return data.query?.search.map((s) => s.title) ?? [];
}
