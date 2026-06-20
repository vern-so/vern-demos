"use client";

import { useCallback, useRef, useState } from "react";
import { CloseIcon, FileIcon, InfoIcon, UploadIcon } from "./Icons";

const ACCEPT =
  ".csv,.xlsx,.xls,.pdf,.docx,.sql,.bak," +
  "text/csv,application/vnd.ms-excel," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const SUPPORTED_TYPES =
  "Supports CSV, Excel, PDF, Word (.docx), SQL dumps (.sql), and database backups (.bak).";

export function Dropzone({
  files,
  onFiles,
  disabled,
  action,
}: {
  files: File[];
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  action?: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const incoming = Array.from(list);
      const merged = [...files];
      for (const f of incoming) {
        if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
      }
      onFiles(merged);
    },
    [files, onFiles],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled) add(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
          over ? "bg-[var(--brand-soft)]" : "border-zinc-200 hover:border-zinc-300"
        } ${disabled ? "pointer-events-none opacity-60" : ""}`}
        style={over ? { borderColor: "var(--brand)" } : undefined}
      >
        <div
          className="mb-3 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
        >
          <UploadIcon className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-zinc-800">
          Drop your exports here, or <span style={{ color: "var(--brand)" }}>browse</span>
        </p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-zinc-400">
          Messy is fine - it handles everything.
          <span className="group relative inline-flex">
            <button
              type="button"
              aria-label={SUPPORTED_TYPES}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center rounded-full text-zinc-400 transition hover:text-zinc-600 focus:outline-none focus-visible:text-zinc-600"
            >
              <InfoIcon className="h-3.5 w-3.5" />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg bg-zinc-900 px-3 py-2 text-left text-[11px] leading-snug text-zinc-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {SUPPORTED_TYPES}
            </span>
          </span>
        </p>
        {action && <div className="mt-5">{action}</div>}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => add(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {files.map((f) => (
            <li
              key={`${f.name}-${f.size}`}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm"
            >
              <FileIcon className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1 truncate text-zinc-700">{f.name}</span>
              <span className="shrink-0 text-xs text-zinc-400">{formatBytes(f.size)}</span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  title="Remove file"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFiles(files.filter((x) => x !== f));
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-1"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
