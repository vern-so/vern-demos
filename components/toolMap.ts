// Maps the agent's raw tool calls to friendly streamed copy + an icon. The
// server emits a tool `name` (and arguments) per action; we render those here so
// the activity feed reads in plain language. Dynamic copy is expressed as small
// functions over the arguments rather than an eval'd condition string.

import {
  BookOpen,
  CircleAlert,
  Columns3,
  DatabaseZap,
  FileCode2,
  FileSearch,
  FileText,
  FlaskConical,
  Globe,
  MessageCircleQuestion,
  Pencil,
  Save,
  ScanText,
  Search,
  Table2,
  Wand2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const TOOL_ICONS: Record<string, LucideIcon> = {
  BookOpen,
  CircleAlert,
  Columns3,
  DatabaseZap,
  FileCode2,
  FileSearch,
  FileText,
  FlaskConical,
  Globe,
  MessageCircleQuestion,
  Pencil,
  Save,
  ScanText,
  Search,
  Table2,
  Wand2,
  Wrench,
};

export type ToolPhase = "research" | "recipe" | "hitl" | "execute" | "unknown";

type Args = Record<string, unknown>;

type ToolDef = {
  phase: ToolPhase;
  icon: keyof typeof TOOL_ICONS;
  copy: string;
  // Optional argument-aware copy. Returns null to fall back to `copy`.
  dynamic?: (a: Args) => string | null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const list = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);
const templateName = (a: Args): string => str(a.templateName) || str(a.templateId) || "target";

export const TOOL_MAP: Record<string, ToolDef> = {
  get_prior_recipe: { phase: "research", icon: "FileCode2", copy: "Looking up your previous import setup" },
  search_prior_runs: { phase: "research", icon: "Search", copy: "Searching your past imports" },
  read_source_notes: { phase: "research", icon: "BookOpen", copy: "Reading what we already know about this source" },
  search_web: {
    phase: "research",
    icon: "Globe",
    copy: "Searching the web about this source",
    dynamic: (a) => (str(a.query) ? `Searching the web: “${str(a.query)}”` : null),
  },
  read_url: {
    phase: "research",
    icon: "BookOpen",
    copy: "Reading a web page",
    dynamic: (a) => (str(a.url) ? `Reading ${str(a.url)}` : null),
  },
  remember_source_research: { phase: "research", icon: "Save", copy: "Saving what we learned about this source" },
  read_source: {
    phase: "research",
    icon: "Table2",
    copy: "Reading your uploaded files",
    dynamic: (a) => (str(a.fileName) ? `Reading “${str(a.fileName)}”` : null),
  },
  query_source: {
    phase: "research",
    icon: "FileSearch",
    copy: "Analyzing your source data",
    dynamic: (a) => (str(a.fileName) ? `Analyzing the data in “${str(a.fileName)}”` : null),
  },
  extract_tables: {
    phase: "research",
    icon: "ScanText",
    copy: "Extracting tables from your file",
    dynamic: (a) => (str(a.fileName) ? `Extracting tables from “${str(a.fileName)}”` : null),
  },
  get_template: {
    phase: "research",
    icon: "Table2",
    copy: "Checking the target templates",
    dynamic: (a) => {
      const ids = list(a.templateIds);
      if (ids && ids.length > 1) return `Checking ${ids.length} templates`;
      if (ids && ids.length === 1) return `Checking the ${templateName(a)} template`;
      if (str(a.columnName)) return `Checking the “${str(a.columnName)}” column`;
      if (str(a.templateId)) return `Checking the ${templateName(a)} template`;
      return null;
    },
  },
  write_recipe: { phase: "recipe", icon: "Wand2", copy: "Drafting the import" },
  view_recipe: {
    phase: "recipe",
    icon: "FileText",
    copy: "Reading the recipe",
    dynamic: (a) =>
      num(a.startLine) != null && num(a.endLine) != null
        ? `Reading the recipe (${num(a.startLine)}–${num(a.endLine)})`
        : null,
  },
  find_in_recipe: {
    phase: "recipe",
    icon: "Search",
    copy: "Searching the recipe",
    dynamic: (a) => (str(a.query) ? `Finding “${str(a.query)}” in the recipe` : null),
  },
  replace_lines: {
    phase: "recipe",
    icon: "Pencil",
    copy: "Editing the recipe",
    dynamic: (a) =>
      num(a.startLine) != null && num(a.endLine) != null
        ? `Editing the recipe (${num(a.startLine)}–${num(a.endLine)})`
        : null,
  },
  str_replace_recipe: { phase: "recipe", icon: "Pencil", copy: "Editing the recipe" },
  dry_run: { phase: "recipe", icon: "FlaskConical", copy: "Testing the recipe on your data" },
  view_preview: { phase: "recipe", icon: "Table2", copy: "Reviewing the preview output" },
  ask_user: { phase: "hitl", icon: "MessageCircleQuestion", copy: "Asking you a question" },
  execute_import: { phase: "execute", icon: "DatabaseZap", copy: "Importing your data" },
  view_invalid_cells: {
    phase: "execute",
    icon: "CircleAlert",
    copy: "Checking which values need fixing",
    dynamic: (a) =>
      str(a.columnName) ? `Checking values that need fixing in “${str(a.columnName)}”` : null,
  },
  profile_columns: {
    phase: "execute",
    icon: "Columns3",
    copy: "Checking which fields came across",
    dynamic: (a) =>
      str(a.source)
        ? `Checking which fields came across in “${str(a.source)}”`
        : str(a.output)
          ? `Checking which fields landed in “${str(a.output)}”`
          : null,
  },
};

const DEFAULT_TOOL: ToolDef = { phase: "unknown", icon: "Wrench", copy: "Working" };

// Resolve the streamed copy + icon for a tool call. Falls back to any
// server-provided text, then to a generic "Working" label.
export function toolDisplay(
  name?: string | null,
  args?: Args,
  fallbackText?: string | null,
): { copy: string; icon: keyof typeof TOOL_ICONS } {
  const def = (name && TOOL_MAP[name]) || null;
  if (!def) {
    return { copy: str(fallbackText) || DEFAULT_TOOL.copy, icon: DEFAULT_TOOL.icon };
  }
  const dynamic = def.dynamic && args ? def.dynamic(args) : null;
  return { copy: dynamic || def.copy, icon: def.icon };
}
