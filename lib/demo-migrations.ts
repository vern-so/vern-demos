import "server-only";
import { hasRegistry, isMissingRegistryTable, registryRequest } from "./registry";
import type { RunReport } from "./types";

// Default cap on completed imports per demo link. A prospect's own
// `import_limit` (see Prospect) overrides this; it's the fallback default.
export const COMPLETE_RUN_LIMIT = 3;

export type DemoMigrationStatus =
  | "created"
  | "mapping"
  | "awaiting_review"
  | "importing"
  | "blocked"
  | "completed"
  | "failed";

export type DemoMigrationRecord = {
  id: string;
  prospect_slug: string;
  email: string | null;
  migration_id: string;
  current_run_id: string | null;
  generate_run_id: string | null;
  update_run_id: string | null;
  execute_run_id: string | null;
  run_kind: "generate" | "update" | "execute" | null;
  status: DemoMigrationStatus;
  templates: string[];
  source: string | null;
  report: RunReport | null;
  resume_after: number | null;
  last_thread_sequence: number | null;
  answers: { after: number; text: string }[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export async function completedCount(prospectSlug: string): Promise<number> {
  if (!hasRegistry()) return 0;
  const { data, error } = await registryRequest<{ id: string }[]>("demo_migrations", {
    query: {
      prospect_slug: `eq.${prospectSlug}`,
      status: "eq.completed",
      select: "id",
    },
  });
  if (isMissingRegistryTable(error)) return 0;
  if (error) throw new Error(`Completed-count lookup failed: ${error.message}`);
  return data?.length ?? 0;
}

export async function listDemoMigrations(prospectSlug: string): Promise<DemoMigrationRecord[]> {
  if (!hasRegistry()) return [];
  const { data, error } = await registryRequest<DemoMigrationRecord[]>("demo_migrations", {
    query: {
      prospect_slug: `eq.${prospectSlug}`,
      status: "neq.created",
      order: "created_at.desc",
      limit: "25",
      select: [
        "id",
        "prospect_slug",
        "email",
        "migration_id",
        "current_run_id",
        "generate_run_id",
        "update_run_id",
        "execute_run_id",
        "run_kind",
        "status",
        "templates",
        "source",
        "report",
        "resume_after",
        "last_thread_sequence",
        "answers",
        "created_at",
        "updated_at",
        "completed_at",
      ].join(","),
    },
  });
  if (isMissingRegistryTable(error)) return [];
  if (error) throw new Error(`Demo migration lookup failed: ${error.message}`);
  return (data || []).filter((row) => row.status !== "created");
}

export async function insertDemoMigration(input: {
  prospectSlug: string;
  email: string | null;
  migrationId: string;
  templates: string[];
  source?: string | null;
}): Promise<DemoMigrationRecord | null> {
  if (!hasRegistry()) return null;
  const { data, error } = await registryRequest<DemoMigrationRecord[]>("demo_migrations", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      prospect_slug: input.prospectSlug,
      email: input.email,
      migration_id: input.migrationId,
      templates: input.templates,
      source: input.source ?? null,
      status: "created",
    }),
  });
  if (isMissingRegistryTable(error)) return null;
  if (error) throw new Error(`Demo migration insert failed: ${error.message}`);
  return data?.[0] ?? null;
}

export async function updateDemoMigration(
  prospectSlug: string,
  migrationId: string,
  patch: Partial<{
    current_run_id: string | null;
    generate_run_id: string | null;
    update_run_id: string | null;
    execute_run_id: string | null;
    run_kind: "generate" | "update" | "execute" | null;
    status: DemoMigrationStatus;
    report: RunReport | null;
    resume_after: number | null;
    last_thread_sequence: number | null;
    answers: { after: number; text: string }[];
    completed_at: string | null;
}>,
): Promise<DemoMigrationRecord | null> {
  if (!hasRegistry()) return null;

  const existing = await getDemoMigration(prospectSlug, migrationId);
  if (existing?.status === "completed" && patch.status !== "completed") {
    throw new Error("Completed demo migrations cannot be changed.");
  }

  const next = {
    ...patch,
    updated_at: new Date().toISOString(),
    ...(patch.status === "completed" && !patch.completed_at
      ? { completed_at: new Date().toISOString() }
      : {}),
  };
  const { data, error } = await registryRequest<DemoMigrationRecord[]>("demo_migrations", {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    query: {
      prospect_slug: `eq.${prospectSlug}`,
      migration_id: `eq.${migrationId}`,
    },
    body: JSON.stringify(next),
  });
  if (isMissingRegistryTable(error)) return null;
  if (error) throw new Error(`Demo migration update failed: ${error.message}`);
  return data?.[0] ?? null;
}

async function getDemoMigration(
  prospectSlug: string,
  migrationId: string,
): Promise<DemoMigrationRecord | null> {
  const { data, error } = await registryRequest<DemoMigrationRecord[]>("demo_migrations", {
    query: {
      prospect_slug: `eq.${prospectSlug}`,
      migration_id: `eq.${migrationId}`,
      select: "id,status",
    },
  });
  if (isMissingRegistryTable(error)) return null;
  if (error) throw new Error(`Demo migration lookup failed: ${error.message}`);
  return data?.[0] ?? null;
}
