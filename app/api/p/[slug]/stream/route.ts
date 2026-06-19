import { NextRequest, NextResponse } from "next/server";
import { getProspect } from "@/lib/demo-config";
import { vernFetch } from "@/lib/vern";
import { cookieName, isGated, verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Proxies the Vern thread SSE stream for one migration, injecting the prospect's
// key + protection-bypass server-side. The browser opens this same-origin and
// reads `event: <type>` + `data: <json>` frames as they arrive.
//   GET /api/p/<slug>/stream?migrationId=...&after=<seq>&include=user|tools|all
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const migrationId = req.nextUrl.searchParams.get("migrationId") || "";
  const after = req.nextUrl.searchParams.get("after");
  const include = req.nextUrl.searchParams.get("include") || "tools";

  if (!/^[0-9a-fA-F-]{36}$/.test(migrationId)) {
    return NextResponse.json({ error: "Invalid migrationId" }, { status: 400 });
  }

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

  const qs = new URLSearchParams({ include });
  if (after) qs.set("after", after);

  const upstream = await vernFetch(`migrations/${migrationId}/thread/stream`, {
    apiKey: prospect.vern_api_key,
    search: qs.toString(),
    headers: { Accept: "text/event-stream" },
    // Abort the upstream stream if the browser disconnects.
    signal: req.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "Stream failed", status: upstream.status, detail: text.slice(0, 200) },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering so frames flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
