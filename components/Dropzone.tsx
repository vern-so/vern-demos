"use client";

import { useCallback, useRef, useState } from "react";
import { CloseIcon, FileIcon, UploadIcon } from "./Icons";

const ACCEPT =
  ".csv,.xlsx,.xls,.pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf";

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
        <p className="mt-1 text-xs text-zinc-400">
          CSV, Excel, or PDF. Messy is fine - it handles everything.
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
