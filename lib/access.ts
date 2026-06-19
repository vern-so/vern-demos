// Server-only helper that resolves a demo + its access state in one place, so the
// root page and /p/[slug] share identical gate logic.

import "server-only";
import { cookies } from "next/headers";
import { getProspect } from "./demo-config";
import { cookieName, isGated, verifySession } from "./auth";
import type { Brand } from "./branding";

export type AccessResult =
  | { exists: false }
  | { exists: true; brand: Brand; product: string; allowed: boolean };

export async function resolveAccess(slug: string): Promise<AccessResult> {
  const p = await getProspect(slug).catch(() => null);
  if (!p) return { exists: false };

  // Only branding crosses to the client — never the key or the allowlist.
  const brand: Brand = { product: p.product, color: p.brand_color, logo: p.logo_url, source: p.source };

  let allowed = true;
  if (isGated(p.verified_emails)) {
    const token = (await cookies()).get(cookieName(slug))?.value;
    allowed = !!verifySession(token, slug);
  }
  return { exists: true, brand, product: p.product, allowed };
}
