import "server-only";

const REGISTRY_URL = process.env.DEMO_REGISTRY_URL?.replace(/\/+$/, "");
const REGISTRY_KEY = process.env.DEMO_REGISTRY_SERVICE_KEY;

export function hasRegistry(): boolean {
  return !!(REGISTRY_URL && REGISTRY_KEY);
}

export async function registryRequest<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string> } = {},
): Promise<{ data: T | null; error: RegistryError | null }> {
  if (!REGISTRY_URL || !REGISTRY_KEY) return { data: null, error: null };

  const url = new URL(`${REGISTRY_URL}/rest/v1/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(init.query || {})) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: REGISTRY_KEY,
      Authorization: `Bearer ${REGISTRY_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      data: null,
      error: {
        status: res.status,
        code: typeof data?.code === "string" ? data.code : undefined,
        message:
          typeof data?.message === "string"
            ? data.message
            : typeof data?.error === "string"
              ? data.error
              : `Registry request failed (${res.status})`,
      },
    };
  }

  return { data: data as T, error: null };
}

export type RegistryError = {
  status: number;
  code?: string;
  message: string;
};

export function isMissingRegistryTable(error: RegistryError | null): boolean {
  return !!(
    error &&
    (error.code === "42P01" ||
      error.code === "PGRST205" ||
      /Could not find the table|relation .* does not exist/i.test(error.message))
  );
}
