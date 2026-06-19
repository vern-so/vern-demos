import { NextRequest, NextResponse } from "next/server";
import { isAllowedPath, vernFetch } from "@/lib/vern";
import { getProspect } from "@/lib/demo-config";
import { cookieName, isGated, verifySession } from "@/lib/auth";
import { hasRegistry } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Per-prospect proxy:
//   /api/p/<slug>/vern/<anything>  ->  <VERN_API_BASE>/api/v1/<anything>
// with the prospect's x-api-key (looked up by slug) + the protection-bypass token
// injected server-side. Restricted to sources/templates/migrations.
async function proxy(req: NextRequest, slug: string, path: string[]): Promise<Response> {
  const joined = path.join("/");
  if (!isAllowedPath(joined)) {
    return NextResponse.json({ error: "Path not allowed" }, { status: 403 });
  }
  if (hasRegistry() && req.method === "POST" && joined === "migrations") {
    return NextResponse.json({ error: "Use the demo migration endpoint." }, { status: 403 });
  }

  const prospect = await getProspect(slug).catch(() => null);
  if (!prospect) {
    return NextResponse.json({ error: "Unknown or inactive demo link" }, { status: 404 });
  }

  // Access gate: a gated prospect requires a valid session cookie.
  if (isGated(prospect.verified_emails)) {
    const token = req.cookies.get(cookieName(slug))?.value;
    if (!verifySession(token, slug)) {
      return NextResponse.json({ error: "Access required" }, { status: 401 });
    }
  }

  const method = req.method;
  let body: BodyInit | null = null;
  const headers: Record<string, string> = {};
  if (method !== "GET" && method !== "HEAD") {
    body = await req.text();
    if (body) headers["Content-Type"] = req.headers.get("content-type") || "application/json";
  }

  const res = await vernFetch(joined, {
    apiKey: prospect.vern_api_key,
    method,
    body,
    headers,
    search: req.nextUrl.search,
  });

  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path } = await ctx.params;
  return proxy(req, slug, path);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path } = await ctx.params;
  return proxy(req, slug, path);
}
