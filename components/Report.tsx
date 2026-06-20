"use client";
import type { RunReport } from "@/lib/types";
import type { VernClient } from "@/lib/client";
import { CheckIcon, DownloadIcon } from "./Icons";
import { Button } from "./Button";
import { BOOK_A_CALL_URL, DOCS_URL } from "@/lib/site";

export function Report({
  report,
  migrationId,
  templates,
  client,
}: {
  report: RunReport | undefined;
  migrationId: string;
  templates: { slug: string; name: string }[];
  client: VernClient;
}) {
  const inserted = num(report?.inserted);
  const invalid = num(report?.invalidCellCount);
  const multiple = templates.length > 1;

  // "Download all" triggers each sheet's CSV (same-origin, so `download` sticks).
  const downloadAll = () => {
    templates.forEach((t, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = client.exportUrl(migrationId, t.slug);
        a.download = `${t.slug}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 350);
    });
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-base font-semibold text-zinc-900">Import complete</p>
          <p className="text-sm text-zinc-500">Clean, validated records are ready to deliver.</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <Stat label="Rows imported" value={inserted != null ? inserted.toLocaleString() : "—"} />
        <Stat
          label="Cells flagged"
          value={invalid != null ? invalid.toLocaleString() : "—"}
          tone={invalid ? "amber" : "default"}
        />
      </div>

      <div className="mt-6">
        <Button variant="secondary" onClick={downloadAll} className="w-full sm:w-auto">
          <DownloadIcon className="h-4 w-4" />
          {multiple
            ? `Download all (${templates.length} files)`
            : `Download ${templates[0]?.slug ?? "clean"}.csv`}
        </Button>
        <p className="mt-2 text-xs text-zinc-400">
          In production this CSV streams straight into your database — your customer never leaves your app.
        </p>
      </div>

      <div className="mt-6 border-t border-zinc-100 pt-5">
        <p className="text-sm font-medium text-zinc-800">Want this inside your product?</p>
        <p className="mt-0.5 text-sm text-zinc-500">
          Everything you just saw runs over the API — embeddable behind your own UI.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <a href={BOOK_A_CALL_URL} target="_blank" rel="noreferrer" className="sm:w-auto">
            <Button className="w-full sm:w-auto">Book a 30-min setup call</Button>
          </a>
          <a href={DOCS_URL} target="_blank" rel="noreferrer" className="sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              Read the API docs
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "amber";
}) {
  return (
    <div className="rounded-lg border border-zinc-200 px-4 py-3">
      <p className="text-xs text-zinc-400">{label}</p>
      <p
        className={`mt-0.5 text-2xl font-semibold tabular-nums ${
          tone === "amber" ? "text-amber-600" : "text-zinc-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
