"use client";

import { CheckIcon } from "./Icons";

export type StepKey = "source" | "upload" | "agent" | "review" | "done";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "upload", label: "Upload" },
  { key: "agent", label: "Mapping" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

export function Stepper({ current }: { current: StepKey }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const state = i < idx ? "done" : i === idx ? "active" : "todo";
        return (
          <li key={step.key} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                  state === "todo" ? "bg-zinc-100 text-zinc-400" : ""
                }`}
                style={
                  state !== "todo"
                    ? { background: "var(--brand)", color: "var(--brand-fg)" }
                    : undefined
                }
              >
                {state === "done" ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={`text-xs ${
                  state === "active" ? "font-medium text-zinc-800" : "text-zinc-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && <span className="h-px w-6 bg-zinc-200" />}
          </li>
        );
      })}
    </ol>
  );
}
