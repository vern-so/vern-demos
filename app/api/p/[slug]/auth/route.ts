import { NextRequest, NextResponse } from "next/server";
import { getProspect } from "@/lib/demo-config";
import { cookieName, emailAllowed, isGated, signSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Exchange an allowed email domain/address for a signed access session.
//   POST /api/p/<slug>/auth  { "email": "person@prospect.com" }
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = typeof body?.email === "string" ? body.email : "";

  const prospect = await getProspect(slug).catch(() => null);
  if (!prospect) {
    return NextResponse.json({ error: "Unknown or inactive demo link" }, { status: 404 });
  }

  // Open demo — no allowlist, nothing to unlock.
  if (!isGated(prospect.verified_emails)) {
    return NextResponse.json({ ok: true, open: true });
  }

  if (!emailAllowed(email, prospect.verified_emails)) {
    return NextResponse.json(
      { error: "That email domain isn't on the access list for this demo." },
      { status: 401 },
    );
  }

  const { token, maxAge } = signSession(slug, email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(slug), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return res;
}
