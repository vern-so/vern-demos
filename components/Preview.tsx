"use client";

import { useState } from "react";
import type { PreviewSheet } from "@/lib/preview";

const PAGE_SIZE = 10;

// Renders the agent's proposed clean output. Invalid cells are surfaced (not
// hidden) — that's the honest, trust-building part of the pitch.
export function Preview({ sheets }: { sheets: PreviewSheet[] }) {
  const [active, setActive] = useState(0);
  const [page, setPage] = useState(0);

  if (sheets.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">
        Preview is ready, but no rows were returned to display.
      </div>
    );
  }

  const sheet = sheets[Math.min(active, sheets.length - 1)];
  const pageCount = Math.max(1, Math.ceil(sheet.rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * PAGE_SIZE;
  const pageRows = sheet.rows.slice(start, start + PAGE_SIZE);

  const selectSheet = (i: number) => {
    setActive(i);
    setPage(0);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {/* Template tabs — always shown, even for a single template. */}
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-3 pt-3">
        {sheets.map((s, i) => (
          <button
            key={s.slug}
            onClick={() => selectSheet(i)}
            className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-sm ${
              i === active ? "font-medium text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
            }`}
            style={i === active ? { borderBottom: "2px solid var(--brand)" } : undefined}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-3 text-xs">
        <span className="text-zinc-500">
          {sheet.total.toLocaleString()} row{sheet.total === 1 ? "" : "s"} mapped
        </span>
        {sheet.invalidCells > 0 ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
            {sheet.invalidCells} flagged cell{sheet.invalidCells > 1 ? "s" : ""}
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
            All values mapped &amp; validated
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-t border-zinc-100 text-sm">
          <thead>
            <tr className="bg-zinc-50/70 text-left">
              <th className="w-10 px-3 py-2 text-xs font-medium text-zinc-400">#</th>
              {sheet.columns.map((c) => (
                <th key={c} className="whitespace-nowrap px-3 py-2 text-xs font-medium text-zinc-500">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={start + ri} className="border-t border-zinc-100">
                <td className="px-3 py-2 text-xs text-zinc-300">{start + ri + 1}</td>
                {sheet.columns.map((_, ci) => {
                  const cell = row.cells[ci];
                  const value = cell?.value ?? "";
                  const invalid = cell && !cell.valid;
                  return (
                    <td
                      key={ci}
                      title={invalid ? cell?.message || "Flagged by validation" : undefined}
                      className={`max-w-[220px] truncate px-3 py-2 ${
                        invalid
                          ? "bg-amber-50/70 text-amber-800"
                          : value
                            ? "text-zinc-700"
                            : "text-zinc-300"
                      }`}
                    >
                      {value || "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2.5 text-xs">
        <span className="text-zinc-400">
          Showing {start + 1}–{Math.min(start + PAGE_SIZE, sheet.rows.length)} of{" "}
          {sheet.rows.length.toLocaleString()}
        </span>
        <div className="flex items-center gap-1">
          <PagerButton disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
            ‹ Prev
          </PagerButton>
          <span className="px-2 text-zinc-500">
            {safePage + 1} / {pageCount}
          </span>
          <PagerButton disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
            Next ›
          </PagerButton>
        </div>
      </div>
    </div>
  );
}

function PagerButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md px-2 py-1 font-medium text-zinc-600 enabled:hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300"
    >
      {children}
    </button>
  );
}
