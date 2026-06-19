import { NextRequest, NextResponse } from "next/server";
import { bypassHeadersFor } from "@/lib/vern";
import { getProspect } from "@/lib/demo-config";
import { cookieName, isGated, verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Proxy a file PUT to a Vern-issued signed storage URL. Done server-side to
// sidestep browser CORS and to attach the protection-bypass token when the
// signed host is on *.vern.so (staging storage sits behind the same protection).
export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  // Access gate.
  const prospect = await getProspect(slug).catch(() => null);
  if (!prospect) {
    return NextResponse.json({ error: "Unknown or inactive demo link" }, { status: 404 });
  }
  if (isGated(prospect.verified_emails)) {
    const token = req.cookies.get(cookieName(slug))?.value;
    if (!verifySession(token, slug)) {
      return NextResponse.json({ error: "Access required" }, { status: 401 });
    }
  }

  const signedUrl = req.headers.get("x-signed-url");
  const contentType = req.headers.get("x-content-type") || "text/csv";

  if (!signedUrl || !/^https:\/\/[^/]+\/.+/.test(signedUrl)) {
    return NextResponse.json({ error: "Missing or invalid signed URL" }, { status: 400 });
  }
  let url: URL;
  try {
    url = new URL(signedUrl);
  } catch {
    return NextResponse.json({ error: "Invalid signed URL" }, { status: 400 });
  }
  if (url.protocol !== "https:") {
    return NextResponse.json({ error: "Signed URL protocol not allowed" }, { status: 400 });
  }

  const body = await req.arrayBuffer();
  const res = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, ...bypassHeadersFor(signedUrl) },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Upload failed", status: res.status, detail: text.slice(0, 300) },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
