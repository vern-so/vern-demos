// Server-only access gate. The "passcode" for a demo link is an email whose
// domain or exact address appears on the configured allowlist. On a match we
// issue a signed, httpOnly session cookie; every page render and API route
// verifies it. A demo with an empty allowlist is open.

import "server-only";
import crypto from "crypto";

const MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days
const DEFAULT_ALLOWED_EMAILS = new Set(["vish@vern.so"]);

export type Session = { slug: string; email: string; exp: number };

export function cookieName(slug: string): string {
  return `vd_${slug}`;
}

function secret(): string {
  const s = process.env.DEMO_SESSION_SECRET;
  if (!s) throw new Error("DEMO_SESSION_SECRET is not set (see .env.local.example).");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signSession(slug: string, email: string): { token: string; maxAge: number } {
  const payload: Session = {
    slug,
    email: email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_S,
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  return { token: `${body}.${sig}`, maxAge: MAX_AGE_S };
}

export function verifySession(token: string | undefined, slug: string): Session | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = b64url(crypto.createHmac("sha256", secret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let payload: Session;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8"));
  } catch {
    return null;
  }
  if (payload.slug !== slug) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
  return payload;
}

// Normalize + check an email against a domain/address allowlist (case-insensitive).
export function emailAllowed(email: string, allowlist: string[] | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  const domain = e.split("@")[1];
  if (!domain) return false;
  if (DEFAULT_ALLOWED_EMAILS.has(e)) return true;

  return (allowlist ?? []).some((entry) => {
    const clean = entry.trim().toLowerCase().replace(/^@/, "");
    if (!clean) return false;
    if (clean.includes("@")) return clean === e;
    return clean === domain;
  });
}

// A prospect with no allowlist is open.
export function isGated(allowlist: string[] | null | undefined): boolean {
  return (allowlist ?? []).length > 0;
}
