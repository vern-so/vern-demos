import { NextRequest, NextResponse } from "next/server";
import { cookieName, isGated, verifySession } from "@/lib/auth";
import { getProspect } from "@/lib/demo-config";
import type { SampleCsvFile, Template } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.5-mini";
const MAX_TEMPLATES = 8;
const MAX_COLUMNS_PER_TEMPLATE = 32;
const MAX_FILES = 8;
const MAX_CSV_CHARS = 90_000;

type SampleRequest = {
  source?: string | null;
  templates?: Template[];
};

type OpenAiTextPart = {
  type?: string;
  text?: string;
};

type OpenAiOutputItem = {
  type?: string;
  content?: OpenAiTextPart[];
};

type OpenAiResponse = {
  output_text?: string;
  output?: OpenAiOutputItem[];
  error?: { message?: string };
};

type SampleBundle = {
  files: SampleCsvFile[];
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["files"],
  properties: {
    files: {
      type: "array",
      minItems: 2,
      maxItems: MAX_FILES,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "csv"],
        properties: {
          name: {
            type: "string",
            description: "A concise CSV filename ending in .csv.",
          },
          description: {
            type: "string",
            description: "One sentence describing the export and its intentional messiness.",
          },
          csv: {
            type: "string",
            description: "Complete RFC 4180-compatible CSV text with a header row and no markdown fences.",
          },
        },
      },
    },
  },
} as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const access = await resolve(req, slug);
  if (access instanceof Response) return access;

  const body = (await req.json().catch(() => null)) as SampleRequest | null;
  const templates = normalizeTemplates(body?.templates);
  if (templates.length === 0) {
    return NextResponse.json({ error: "At least one selected template is required." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set, so sample CSVs cannot be generated." },
      { status: 503 },
    );
  }

  const source = cleanShortText(body?.source) || access.prospect.source || null;
  const context = {
    prospect: {
      name: access.prospect.name,
      product: access.prospect.product,
      configuredSource: access.prospect.source,
      selectedSource: source,
    },
    templates,
    constraints: {
      maxRowsPerCsv: 50,
      fileCount: `Generate between 2 and ${MAX_FILES} CSV files. Use multiple files even when one template is selected.`,
      csvFormat: "Comma-separated CSV with a header row. Quote fields containing commas, quotes, or newlines.",
    },
  };

  const upstream = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SAMPLE_MODEL || DEFAULT_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You generate realistic, fictitious CSV exports for data migration demos.",
                "Use the provided product, source system, and template schemas to infer domain-specific fields, values, relationships, and messiness.",
                "The CSVs should feel like real customer exports, not toy examples.",
                "Make the messiness recoverable by a migration agent: renamed and inconsistent headers, extra source-only columns, missing optional values, malformed emails or phone numbers, mixed date formats, status synonyms, duplicates, whitespace/casing drift, relationship/link columns, and quoted notes with commas.",
                "Tailor issues to the template rules and source context. Required fields may be missing in some rows, but most rows should be usable.",
                "Use only fictitious people, companies, emails, addresses, and IDs.",
                "Do not include markdown fences or commentary inside CSV strings.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify(context) }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "sample_csv_bundle",
          strict: true,
          schema,
        },
      },
      max_output_tokens: 12000,
    }),
  });

  const data = (await upstream.json().catch(() => null)) as OpenAiResponse | null;
  if (!upstream.ok) {
    return NextResponse.json(
      { error: data?.error?.message || "OpenAI sample generation failed." },
      { status: upstream.status },
    );
  }

  const parsed = parseBundle(data);
  if (!parsed) {
    return NextResponse.json({ error: "OpenAI returned an invalid sample-data response." }, { status: 502 });
  }

  const files = sanitizeFiles(parsed.files, access.prospect.product);
  if (files.length === 0) {
    return NextResponse.json({ error: "OpenAI returned no usable sample CSVs." }, { status: 502 });
  }

  return NextResponse.json({ files });
}

async function resolve(req: NextRequest, slug: string) {
  const prospect = await getProspect(slug).catch(() => null);
  if (!prospect) {
    return NextResponse.json({ error: "Unknown or inactive demo link" }, { status: 404 });
  }

  if (isGated(prospect.verified_emails)) {
    const session = verifySession(req.cookies.get(cookieName(slug))?.value, slug);
    if (!session) return NextResponse.json({ error: "Access required" }, { status: 401 });
  }

  return { prospect };
}

function normalizeTemplates(value: unknown): Template[] {
  if (!Array.isArray(value)) return [];
  const templates: Template[] = [];
  for (const template of value) {
    if (templates.length >= MAX_TEMPLATES) break;
    if (!template || typeof template !== "object") continue;
    const t = template as Template;
    const slug = cleanShortText(t.slug);
    const name = cleanShortText(t.name);
    if (!slug || !name) continue;
    templates.push({
      slug,
      name,
      description: cleanShortText(t.description) || null,
      columns: Array.isArray(t.columns)
        ? t.columns.slice(0, MAX_COLUMNS_PER_TEMPLATE).map((column) => ({
            name: cleanShortText(column.name) || "Field",
            description: cleanShortText(column.description) || null,
            required: !!column.required,
            unique: !!column.unique,
            desiredRule: cleanShortText(column.desiredRule) || undefined,
            strictRule: cleanShortText(column.strictRule) || undefined,
            linkRule: Array.isArray(column.linkRule) ? column.linkRule.slice(0, 4) : undefined,
          }))
        : [],
    });
  }
  return templates;
}

function parseBundle(data: OpenAiResponse | null): SampleBundle | null {
  const text = extractOutputText(data);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Partial<SampleBundle>;
    if (!Array.isArray(parsed.files)) return null;
    return { files: parsed.files };
  } catch {
    return null;
  }
}

function extractOutputText(data: OpenAiResponse | null): string | null {
  if (!data) return null;
  if (typeof data.output_text === "string") return data.output_text;

  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if ((part.type === "output_text" || part.type === "text") && typeof part.text === "string") {
        return part.text;
      }
    }
  }
  return null;
}

function sanitizeFiles(files: unknown, product: string): SampleCsvFile[] {
  if (!Array.isArray(files)) return [];
  const used = new Set<string>();
  const prefix = slugify(product) || "sample";
  const cleanFiles: SampleCsvFile[] = [];
  for (const file of files) {
    if (cleanFiles.length >= MAX_FILES) break;
    if (!file || typeof file !== "object") continue;
    const f = file as Partial<SampleCsvFile>;
    const csv = typeof f.csv === "string" ? f.csv.replace(/\r?\n/g, "\n").slice(0, MAX_CSV_CHARS).trim() : "";
    if (!csv.includes(",") || !csv.includes("\n")) continue;
    let name =
      slugify(typeof f.name === "string" ? f.name.replace(/\.csv$/i, "") : "") ||
      `${prefix}-sample-${cleanFiles.length + 1}`;
    name = `${name}.csv`;
    while (used.has(name)) name = `${name.replace(/\.csv$/i, "")}-${used.size + 1}.csv`;
    used.add(name);
    cleanFiles.push({
      name,
      description: cleanShortText(f.description) || "Generated sample data",
      csv: `${csv}\n`,
    });
  }
  return cleanFiles;
}

function cleanShortText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, 500) : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
