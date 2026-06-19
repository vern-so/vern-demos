// Browser-side wrappers around our per-prospect /api proxy. None of these ever
// see an API key — every call is scoped to a prospect slug and proxied server-side.

import type { DemoMigration, Migration, Run, RunReport, SampleCsvFile, Source, Template, ThreadEvent } from "./types";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, data: unknown) {
    super(extractMessage(data) || `Request failed (${status})`);
    this.status = status;
    this.data = data;
  }
}

function extractMessage(data: unknown): string | null {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.error === "string") return d.error;
    if (typeof d.message === "string") return d.message;
  }
  return null;
}

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

async function jpost<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

async function jpatch<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type VernClient = ReturnType<typeof makeClient>;

// All calls are scoped under /api/p/<slug>/... so the proxy can resolve the key.
export function makeClient(slug: string) {
  const base = `/api/p/${encodeURIComponent(slug)}`;

  async function listSources(): Promise<Source[]> {
    const d = await jget<{ sources: Source[] }>(`${base}/vern/sources`);
    return d.sources || [];
  }

  async function listTemplates(): Promise<Template[]> {
    const d = await jget<{ templates: Template[] }>(`${base}/vern/templates`);
    return d.templates || [];
  }

  async function createMigration(input: {
    name: string;
    source?: string | null;
    external_id?: string;
    templates: string[];
  }): Promise<Migration> {
    const d = await jpost<{ migration: Migration }>(`${base}/demo-migrations`, input);
    return d.migration;
  }

  async function listDemoMigrations(): Promise<{
    migrations: DemoMigration[];
    completedCount: number;
    completeLimit: number;
  }> {
    return jget(`${base}/demo-migrations`);
  }

  async function updateDemoMigration(
    migrationId: string,
    patch: Partial<{
      current_run_id: string | null;
      generate_run_id: string | null;
      update_run_id: string | null;
      execute_run_id: string | null;
      run_kind: "generate" | "update" | "execute" | null;
      status: DemoMigration["status"];
      report: RunReport | null;
      resume_after: number | null;
      last_thread_sequence: number | null;
      completed_at: string | null;
    }>,
  ): Promise<DemoMigration | null> {
    const d = await jpatch<{ migration: DemoMigration | null }>(
      `${base}/demo-migrations/${migrationId}`,
      patch,
    );
    return d.migration;
  }

  async function requestUploadUrls(
    migrationId: string,
    files: { name: string; content_type: string }[],
  ): Promise<{ name: string; signed_url: string; content_type: string }[]> {
    const d = await jpost<{ files: { name: string; signed_url: string; content_type: string }[] }>(
      `${base}/vern/migrations/${migrationId}/files`,
      { files },
    );
    return d.files || [];
  }

  async function uploadToSignedUrl(signedUrl: string, file: File): Promise<void> {
    const res = await fetch(`${base}/upload`, {
      method: "PUT",
      headers: { "x-signed-url": signedUrl, "x-content-type": file.type || "text/csv" },
      body: await file.arrayBuffer(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new ApiError(res.status, data);
    }
  }

  async function startRun(
    migrationId: string,
    kind: "generate" | "update" | "execute",
    extra?: Record<string, unknown>,
  ): Promise<Run> {
    return jpost<Run>(`${base}/vern/migrations/${migrationId}/runs`, { kind, ...extra });
  }

  async function getRun(migrationId: string, runId: string): Promise<Run> {
    return jget<Run>(`${base}/vern/migrations/${migrationId}/runs/${runId}`);
  }

  async function answerQuestions(
    migrationId: string,
    runId: string,
    answers: { id: string; value: string }[] | string,
  ): Promise<unknown> {
    return jpost(`${base}/vern/migrations/${migrationId}/runs/${runId}/messages`, { answers });
  }

  async function getPreview(migrationId: string): Promise<unknown> {
    return jget(`${base}/vern/migrations/${migrationId}/preview`);
  }

  async function generateSampleData(input: {
    source: string | null;
    templates: Template[];
  }): Promise<{ files: SampleCsvFile[] }> {
    return jpost(`${base}/sample-data`, input);
  }

  // Snapshot of the agent's activity thread (used to rebuild the feed on resume).
  async function getThreadSnapshot(
    migrationId: string,
    opts: { include?: "user" | "tools" | "all"; after?: number } = {},
  ): Promise<{ events: ThreadEvent[]; last_sequence: number | null }> {
    const qs = new URLSearchParams({ include: opts.include ?? "tools" });
    if (opts.after != null) qs.set("after", String(opts.after));
    return jget(`${base}/vern/migrations/${migrationId}/thread?${qs.toString()}`);
  }

  function exportUrl(migrationId: string, slug: string, validOnly = false): string {
    const q = validOnly ? "?filter=valid" : "";
    return `${base}/vern/migrations/${migrationId}/exports/${slug}.csv${q}`;
  }

  // Poll a run until it leaves the queued/running state (or times out).
  async function pollRun(
    migrationId: string,
    runId: string,
    opts: { onTick?: (run: Run) => void; intervalMs?: number; timeoutMs?: number } = {},
  ): Promise<Run> {
    const interval = opts.intervalMs ?? 2500;
    const timeout = opts.timeoutMs ?? 5 * 60 * 1000;
    const start = performance.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const run = await getRun(migrationId, runId);
      opts.onTick?.(run);
      const s = run.status;
      if (s !== "queued" && s !== "running") return run;
      if (performance.now() - start > timeout) {
        throw new Error("Timed out waiting for the agent. Try again.");
      }
      await sleep(interval);
    }
  }

  // Live SSE stream of the agent's activity thread for a migration. Calls
  // onEvent for every event as it arrives; transparently reconnects with
  // ?after=<last_sequence> if the stream closes before the agent is done.
  // Resolves once a `done` frame is seen (no active run + backlog drained).
  async function streamThread(
    migrationId: string,
    opts: {
      onEvent: (ev: ThreadEvent) => void;
      after?: number;
      include?: "user" | "tools" | "all";
      signal?: AbortSignal;
      maxMs?: number;
    },
  ): Promise<number | undefined> {
    const include = opts.include ?? "tools";
    const maxMs = opts.maxMs ?? 8 * 60 * 1000;
    const start = performance.now();
    let cursor = opts.after;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const qs = new URLSearchParams({ migrationId, include });
      if (cursor != null) qs.set("after", String(cursor));
      const res = await fetch(`${base}/stream?${qs.toString()}`, {
        cache: "no-store",
        signal: opts.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new ApiError(res.status, data);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let sawDone = false;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let sep: number;
        // SSE frames are separated by a blank line.
        while ((sep = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          const ev = parseSseFrame(frame);
          if (!ev) continue;
          if (typeof ev.sequence === "number") cursor = ev.sequence;
          if (ev.type === "done") {
            const seq = (ev.data as { last_sequence?: number })?.last_sequence;
            if (typeof seq === "number") cursor = seq;
            sawDone = true;
          }
          opts.onEvent(ev);
        }
      }

      if (sawDone) return cursor;
      if (performance.now() - start > maxMs) return cursor;
      // Stream closed on its time budget without `done` → reconnect and resume.
    }
  }

  return {
    slug,
    listSources,
    listTemplates,
    createMigration,
    listDemoMigrations,
    updateDemoMigration,
    requestUploadUrls,
    uploadToSignedUrl,
    startRun,
    getRun,
    answerQuestions,
    getPreview,
    generateSampleData,
    getThreadSnapshot,
    exportUrl,
    pollRun,
    streamThread,
  };
}

// Parse one SSE frame ("event: <type>\ndata: <json>") into a ThreadEvent.
function parseSseFrame(frame: string): ThreadEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  try {
    const parsed = JSON.parse(raw);
    // Most frames carry the full event object; `done` carries just {last_sequence}.
    if (parsed && typeof parsed === "object" && "type" in parsed) return parsed as ThreadEvent;
    return { sequence: parsed?.sequence ?? -1, type: event, data: parsed } as ThreadEvent;
  } catch {
    return { sequence: -1, type: event, data: raw } as ThreadEvent;
  }
}
