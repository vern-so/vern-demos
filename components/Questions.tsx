"use client";

import { useState } from "react";
import type { AgentQuestion } from "@/lib/types";
import { AlertIcon } from "./Icons";
import { Button } from "./Button";

// Renders the agent's clarifying questions and collects answers. This is the
// moment that sells the product: the agent surfaces a real ambiguity in plain
// language instead of silently guessing.
export function Questions({
  questions,
  onSubmit,
  submitting,
}: {
  questions: AgentQuestion[];
  onSubmit: (answers: { id: string; value: string }[]) => void;
  submitting?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});

  const set = (id: string, value: string) => setValues((v) => ({ ...v, [id]: value }));

  const resolve = (q: AgentQuestion): string => {
    const v = values[q.id];
    if (v === "__custom__") return custom[q.id]?.trim() || "";
    if (v) return v;
    // No options → treat the typed custom value as the answer.
    if (!q.options?.length) return custom[q.id]?.trim() || "";
    return "";
  };

  const allAnswered = questions.every((q) => resolve(q).length > 0);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
          <AlertIcon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-800">A quick decision needed</p>
          <p className="text-xs text-zinc-500">
            {questions.length === 1
              ? "One thing we'd rather not guess on."
              : `${questions.length} things we'd rather not guess on.`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-5">
        {questions.map((q) => {
          const hasOptions = !!q.options?.length;
          const picked = values[q.id];
          return (
            <div key={q.id} className="rounded-lg border border-amber-200/70 bg-white p-4">
              <p className="text-sm font-medium text-zinc-800">{q.question}</p>
              {q.context && <p className="mt-1 text-xs text-zinc-500">{q.context}</p>}

              <div className="mt-3 flex flex-col gap-2">
                {q.options?.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
                      picked === opt.label
                        ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      className="accent-[var(--brand)]"
                      checked={picked === opt.label}
                      onChange={() => set(q.id, opt.label)}
                    />
                    <span className="text-zinc-700">{opt.label}</span>
                  </label>
                ))}

                {(q.allowCustom || !hasOptions) && (
                  <div>
                    {hasOptions && (
                      <label className="flex cursor-pointer items-center gap-2.5 px-1 py-1 text-sm">
                        <input
                          type="radio"
                          name={q.id}
                          className="accent-[var(--brand)]"
                          checked={picked === "__custom__"}
                          onChange={() => set(q.id, "__custom__")}
                        />
                        <span className="text-zinc-500">Something else…</span>
                      </label>
                    )}
                    {(!hasOptions || picked === "__custom__") && (
                      <input
                        type="text"
                        autoFocus={!hasOptions}
                        placeholder="Type your answer"
                        value={custom[q.id] || ""}
                        onChange={(e) => setCustom((c) => ({ ...c, [q.id]: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          onClick={() => onSubmit(questions.map((q) => ({ id: q.id, value: resolve(q) })))}
          disabled={!allAnswered}
          loading={submitting}
        >
          Send answer{questions.length > 1 ? "s" : ""} & continue
        </Button>
      </div>
    </div>
  );
}
