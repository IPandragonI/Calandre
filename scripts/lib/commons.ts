// Wikimedia Commons helpers for the catalogue builder.
// Metadata only: photographs are never downloaded, the game hotlinks them.

export const USER_AGENT = "CalandreCatalogBuilder/2.1 (https://github.com/IPandragonI/Calandre; offline car quiz dataset script)";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

/** Width of the thumbnail the game displays; Wikimedia serves it from its standard thumbnail steps. */
export const DISPLAY_WIDTH = 1280;

export interface CommonsFileInfo {
  /** "File:Name.jpg" */
  title: string;
  sourcePage: string;
  /** Remote URL used by the game: the 1280 px thumbnail, or the original when it is smaller. */
  url: string;
  width: number;
  height: number;
  mime: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  licenseAllowed: boolean;
}

/**
 * Licenses we can display with attribution. Anything else (unknown, fair use,
 * non-commercial, GFDL-only…) is rejected and never enters the catalogue.
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

export async function fetchWithRetry(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      // A stalled connection must not hang the whole build: time out and retry.
      res = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, ...init.headers }, signal: AbortSignal.timeout(30_000) });
    } catch (error) {
      // Network hiccup (timeout, reset): retry a few times before giving up.
      if (attempt >= 4) throw error;
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (res.ok || (res.status < 500 && res.status !== 429)) return res;
    if (attempt >= 6) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    // Wikimedia asks clients to honour Retry-After when throttled.
    const retryAfter = Number(res.headers.get("retry-after"));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000 * (attempt + 1));
  }
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithRetry(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

interface ImageInfoResponse {
  query?: {
    normalized?: { from: string; to: string }[];
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
          mime: string;
          descriptionurl: string;
          extmetadata?: Record<string, { value: string } | undefined>;
        }[];
      }
    >;
  };
}

/** Licensing metadata and display URL for up to 50 Commons files per request. */
export async function fetchFileInfos(titles: string[]): Promise<CommonsFileInfo[]> {
  if (titles.length === 0) return [];
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: String(DISPLAY_WIDTH),
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
      // Without the tracking parameters Commons now appends.
      url: (info.thumburl ?? info.url).replace(/[?#].*$/, ""),
      width: info.width,
      height: info.height,
      mime: info.mime,
      author: stripHtml(meta.Artist?.value ?? "") || "Unknown",
      license,
      licenseUrl: meta.LicenseUrl?.value ?? null,
      licenseAllowed: isAllowedLicense(license),
    });
  }
  return out;
}

/** Checks that a remote image answers (HEAD only, the body is never downloaded). */
export async function checkImageUrl(url: string): Promise<number> {
  // No automatic retry: a 429 is reported so the caller can stop instead of waiting it out.
  const res = await fetch(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
  return res.status;
}
