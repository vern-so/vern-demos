import { NextRequest, NextResponse } from "next/server";
import { updateDemoMigration } from "@/lib/demo-migrations";
import { cookieName, isGated, verifySession } from "@/lib/auth";
import { getProspect } from "@/lib/demo-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; migrationId: string }> },
) {
  const { slug, migrationId } = await ctx.params;
  if (!/^[0-9a-fA-F-]{36}$/.test(migrationId)) {
    return NextResponse.json({ error: "Invalid migrationId" }, { status: 400 });
  }

  const prospect = await getProspect(slug).catch(() => null);
  if (!prospect) {
    return NextResponse.json({ error: "Unknown or inactive demo link" }, { status: 404 });
  }
  if (isGated(prospect.verified_emails)) {
    const session = verifySession(req.cookies.get(cookieName(slug))?.value, slug);
    if (!session) return NextResponse.json({ error: "Access required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Missing patch body" }, { status: 400 });

  try {
    const row = await updateDemoMigration(slug.toLowerCase(), migrationId, cleanPatch(body));
    return NextResponse.json({ migration: row });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Demo migration update failed" },
      { status: 400 },
    );
  }
}

function cleanPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const key of [
    "current_run_id",
    "generate_run_id",
    "update_run_id",
    "execute_run_id",
    "run_kind",
    "status",
    "report",
    "resume_after",
    "last_thread_sequence",
    "completed_at",
  ]) {
    if (key in body) patch[key] = body[key];
  }
  return patch;
}
