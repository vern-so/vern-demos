import "server-only";
import { hasRegistry, registryRequest } from "./registry";
import { COMPLETE_RUN_LIMIT } from "./demo-migrations";

export const DEFAULT_SLUG = "demo";

export type Prospect = {
  slug: string;
  name: string;
  product: string;
  vern_api_key: string;
  brand_color: string;
  logo_url: string | null;
  source: string | null;
  verified_emails: string[];
  import_limit: number;
  active: boolean;
};

function parseLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isInteger(n) && n >= 0 ? n : COMPLETE_RUN_LIMIT;
}

function parseEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[,\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

export async function getProspect(slug: string): Promise<Prospect | null> {
  if (hasRegistry()) {
    const key = slug.toLowerCase();
    const { data, error } = await registryRequest<Prospect[]>("demo_prospects", {
      query: {
        slug: `eq.${key}`,
        active: "eq.true",
        select: "slug,name,product,vern_api_key,brand_color,logo_url,source,verified_emails,import_limit,active",
      },
    });
    if (error) throw new Error(`Demo lookup failed: ${error.message}`);
    return data?.[0] ?? null;
  }

  const key = process.env.VERN_API_KEY;
  if (!key) return null;

  const product = process.env.DEMO_PRODUCT || "Acme";
  return {
    slug,
    name: product,
    product,
    vern_api_key: key,
    brand_color: process.env.DEMO_BRAND_COLOR || "#4F46E5",
    logo_url: process.env.DEMO_LOGO_URL || null,
    source: process.env.DEMO_SOURCE || null,
    verified_emails: parseEmails(process.env.DEMO_VERIFIED_EMAILS),
    import_limit: parseLimit(process.env.DEMO_IMPORT_LIMIT),
    active: true,
  };
}
