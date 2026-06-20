import { NextRequest, NextResponse } from "next/server";
import {
  COMPLETE_RUN_LIMIT,
  completedCount,
  insertDemoMigration,
  listDemoMigrations,
} from "@/lib/demo-migrations";
import { cookieName, isGated, verifySession } from "@/lib/auth";
import { getProspect } from "@/lib/demo-config";
import { notifyDemoCreated } from "@/lib/notify";
import { vernFetch } from "@/lib/vern";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const access = await resolve(req, (await ctx.params).slug);
  if (access instanceof Response) return access;

  const [items, count] = await Promise.all([
    listDemoMigrations(access.slug),
    completedCount(access.slug),
  ]);
  return NextResponse.json({
    migrations: items,
    completedCount: count,
    completeLimit: COMPLETE_RUN_LIMIT,
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const access = await resolve(req, (await ctx.params).slug);
  if (access instanceof Response) return access;

  const count = await completedCount(access.slug);
  if (count >= COMPLETE_RUN_LIMIT) {
    return NextResponse.json(
      { error: `This demo link has reached its ${COMPLETE_RUN_LIMIT}-import limit.` },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    source?: string | null;
    external_id?: string;
    templates?: string[];
  } | null;
  if (!body || !Array.isArray(body.templates) || body.templates.length === 0) {
    return NextResponse.json({ error: "At least one template is required." }, { status: 400 });
  }

  const upstream = await vernFetch("migrations", {
    apiKey: access.prospect.vern_api_key,
    method: "POST",
    body: JSON.stringify({
      name: body.name,
      source: body.source ?? null,
      external_id: body.external_id,
      templates: body.templates,
    }),
    headers: { "Content-Type": "application/json" },
  });
  const data = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(data || { error: "Migration creation failed" }, { status: upstream.status });
  }

  const migrationId = data?.migration?.id;
  if (typeof migrationId === "string") {
    await insertDemoMigration({
      prospectSlug: access.slug,
      email: access.email,
      migrationId,
      templates: body.templates,
      source: body.source ?? null,
    });
    await notifyDemoCreated({
      product: access.prospect.product,
      slug: access.slug,
      email: access.email,
      templates: body.templates,
      source: body.source ?? null,
      migrationId,
    });
  }

  return NextResponse.json(data, { status: upstream.status });
}

async function resolve(req: NextRequest, slug: string) {
  const prospect = await getProspect(slug).catch(() => null);
  if (!prospect) {
    return NextResponse.json({ error: "Unknown or inactive demo link" }, { status: 404 });
  }

  let email: string | null = null;
  if (isGated(prospect.verified_emails)) {
    const session = verifySession(req.cookies.get(cookieName(slug))?.value, slug);
    if (!session) return NextResponse.json({ error: "Access required" }, { status: 401 });
    email = session.email;
  }

  return { slug: slug.toLowerCase(), prospect, email };
}
