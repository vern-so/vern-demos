"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { TOOL_ICONS } from "./toolMap";

// One chronological item in the agent's live activity: a chunk of streamed prose,
// or a tool action it took. They interleave in the order they actually happened.
export type FeedItem =
  | { kind: "text"; text: string }
  | { kind: "tool"; id: number; text: string; icon?: string }
  | { kind: "user"; id?: number; text: string };

function ToolGlyph({ icon }: { icon?: string }) {
  const Icon = (icon && TOOL_ICONS[icon]) || TOOL_ICONS.Wrench;
  return <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />;
}

export function AgentActivity({
  feed,
  settled,
  awaitingInput,
  kind,
  elapsed,
}: {
  feed: FeedItem[];
  settled: boolean;
  awaitingInput?: boolean;
  kind: "generate" | "execute";
  elapsed: number;
}) {
  const { headline, sub } = copy(kind, settled, !!awaitingInput);
  const live = !settled && !awaitingInput;

  const lastTool = [...feed].reverse().find((i) => i.kind === "tool") as
    | { kind: "tool"; text: string }
    | undefined;
  const currentLabel = lastTool?.text || "Thinking";
  const hasContent = feed.some((i) => (i.kind === "tool" ? true : i.text.trim().length > 0));

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-800">{headline}</p>
        <p className="truncate text-xs text-zinc-400">{sub}</p>
      </div>

      {hasContent && (
        <Stream feed={feed} live={live} label={currentLabel} elapsed={elapsed} />
      )}
    </div>
  );
}

function copy(kind: "generate" | "execute", settled: boolean, awaitingInput: boolean) {
  if (awaitingInput) {
    return { headline: "One quick question", sub: "Answer below to keep going." };
  }
  if (kind === "execute") {
    return settled
      ? { headline: "Your import is complete", sub: "Your records are clean and ready." }
      : { headline: "Importing your records", sub: "Writing your cleaned data." };
  }
  return settled
    ? { headline: "Your preview is ready", sub: "Review the mapped data — nothing's been imported yet." }
    : { headline: "Mapping your data", sub: "Reading your file and building the import." };
}

// Auto-scrolling, max-height stream that interleaves prose and tool actions, with
// a loader row (spinner + current activity + timer) while the agent is working.
function Stream({
  feed,
  live,
  label,
  elapsed,
}: {
  feed: FeedItem[];
  live: boolean;
  label: string;
  elapsed: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [feed, live, label]);

  return (
    <div
      ref={ref}
      className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/60 p-3 text-[13px] leading-relaxed text-zinc-600"
    >
      {feed.map((item, i) =>
        item.kind === "tool" ? (
          <div key={`t${item.id}`} className="my-2 flex items-center gap-2">
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center"
              style={{ color: "var(--brand)" }}
            >
              <ToolGlyph icon={item.icon} />
            </span>
            <span className="font-medium text-zinc-700">{item.text}</span>
          </div>
        ) : item.kind === "user" ? (
          <div key={`u${item.id ?? i}`} className="my-2 flex justify-end">
            <div className="max-w-[85%] rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <Markdown text={item.text} tone="user" />
            </div>
          </div>
        ) : (
          <Markdown key={`x${i}`} text={item.text} />
        ),
      )}
      {live && (
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
          <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-zinc-300 border-t-[var(--brand)]" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="shrink-0 tabular-nums text-zinc-300">{formatElapsed(elapsed)}</span>
        </div>
      )}
    </div>
  );
}

function formatElapsed(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function Markdown({ text, tone = "agent" }: { text: string; tone?: "agent" | "user" }) {
  return (
    <div className={`min-w-0 break-words ${tone === "user" ? "text-zinc-700" : "text-zinc-600"}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-semibold text-zinc-800">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-sm font-semibold text-zinc-800">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-sm font-semibold text-zinc-800">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-2 text-[13px] font-semibold text-zinc-800">{children}</h4>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-zinc-300 pl-3 text-zinc-500">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-zinc-200" />,
  strong: ({ children }) => <strong className="font-semibold text-zinc-800">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-[var(--brand)] underline decoration-zinc-300 underline-offset-2"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="my-2 max-w-full overflow-x-auto rounded-md border border-zinc-200 bg-white p-3 text-[12px] leading-relaxed text-zinc-700">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const block = typeof className === "string" && className.startsWith("language-");
    if (block) {
      return <code className="font-mono text-[12px]">{children}</code>;
    }
    return (
      <code className="rounded border border-zinc-200 bg-white px-1 py-0.5 font-mono text-[12px] text-zinc-800">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <table className="my-2 block max-w-full overflow-x-auto border-collapse text-left text-[12px]">
      {children}
    </table>
  ),
  thead: ({ children }) => <thead className="bg-zinc-100 text-zinc-700">{children}</thead>,
  th: ({ children }) => <th className="border border-zinc-200 px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-zinc-200 px-2 py-1 align-top">{children}</td>,
  input: (props) => (
    <input
      {...props}
      className="mr-1.5 align-middle accent-[var(--brand)]"
      readOnly
      disabled={props.disabled}
    />
  ),
};
