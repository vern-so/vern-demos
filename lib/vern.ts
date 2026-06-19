// Server-only helper for talking to the Vern Migration API.
// The demo key is resolved server-side and passed in here; it never reaches the browser.

// Vern API base. Defaults to the public API; override via VERN_API_BASE.
export const VERN_BASE = process.env.VERN_API_BASE || "https://app.vern.so";

// Optional Vercel protection-bypass token, only needed when VERN_API_BASE points
// at a deployment behind Vercel Deployment Protection (e.g. a staging env).
const BYPASS = process.env.VERN_PROTECTION_BYPASS || "";

// First path segment must be one of these — keeps the public proxy from being
// used to hit arbitrary endpoints with the demo key.
const ALLOWED_PREFIXES = new Set(["sources", "templates", "migrations"]);

export function isAllowedPath(path: string): boolean {
  const head = path.replace(/^\/+/, "").split("/")[0]?.split("?")[0] ?? "";
  return ALLOWED_PREFIXES.has(head);
}

type VernFetchOpts = {
  apiKey: string;
  method?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  search?: string; // raw query string, with or without leading "?"
  signal?: AbortSignal;
};

function authHeaders(apiKey: string): Record<string, string> {
  const h: Record<string, string> = { "x-api-key": apiKey };
  if (BYPASS) h["x-vercel-protection-bypass"] = BYPASS;
  return h;
}

// Low-level fetch against the Vern API with auth + bypass injected.
export async function vernFetch(path: string, opts: VernFetchOpts): Promise<Response> {
  const clean = path.replace(/^\/+/, "");
  const search = opts.search ? (opts.search.startsWith("?") ? opts.search : `?${opts.search}`) : "";
  const url = `${VERN_BASE}/api/v1/${clean}${search}`;
  return fetch(url, {
    method: opts.method || "GET",
    headers: { ...authHeaders(opts.apiKey), ...(opts.headers || {}) },
    body: opts.body ?? null,
    cache: "no-store",
    signal: opts.signal,
  });
}

// Attach the bypass token to a same-origin (*.vern.so) signed storage URL so the
// upload PUT also gets through staging's deployment protection.
export function bypassHeadersFor(targetUrl: string): Record<string, string> {
  if (!BYPASS) return {};
  try {
    const host = new URL(targetUrl).hostname;
    return host.endsWith(".vern.so") ? { "x-vercel-protection-bypass": BYPASS } : {};
  } catch {
    return {};
  }
}
