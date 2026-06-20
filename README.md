# Vern Migration Demo

An embeddable UI for the [Vern Migration API](https://docs.vern.so/migration-api/introduction).
Drop in messy exports — CSV, Excel, PDF, Word, SQL dumps, or database backups — and watch Vern
map, validate, preview, and import the data inside a product-style workflow.

The point of this demo is simple: messy customer data should feel easy to migrate.

## What It Shows

- **Messy files in**: renamed headers, missing values, duplicates, spreadsheets, PDFs, Word docs, SQL dumps, database backups, and rough exports.
- **Agent-authored mapping**: live activity shows the agent reading files, building a mapping, testing it, and asking only useful questions.
- **Validated preview**: mapped rows are reviewable before import, with flagged cells surfaced instead of silently dropped.
- **Clean data out**: run the import and download validated CSV exports.
- **Sample files**: optionally generate realistic messy files with OpenAI when you do not have an export handy.

## API Flow

| UI step | Vern API |
| --- | --- |
| Load setup | `GET /sources`, `GET /templates` |
| Upload files | `POST /migrations` -> `POST /migrations/{id}/files` -> signed `PUT` |
| Map and validate | `POST /migrations/{id}/runs` with `{ kind: "generate" }` |
| Watch progress | `GET /migrations/{id}/thread/stream` |
| Answer questions | `POST /migrations/{id}/runs/{runId}/messages` |
| Review result | `GET /migrations/{id}/preview` |
| Import | `POST /migrations/{id}/runs` with `{ kind: "execute" }` |
| Export clean data | `GET /migrations/{id}/exports/{template}.csv` |

The browser never sees your Vern API key. All Vern requests go through the local Next.js API
routes, which inject the key server-side.

## Quick Start

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Set `VERN_API_KEY` in `.env.local`, then open `http://localhost:3000`.

## Deploy

Import the repo into Vercel and set the one required key:

| Key | Required | Purpose |
| --- | --- | --- |
| `VERN_API_KEY` | Yes | Authenticates requests to Vern. |

That is all you need to run the demo. Every other setting is optional — sample-file generation,
API overrides, branding, the access gate, and UI links are all documented in `.env.local.example`.

## Agent Activity Tools

As the agent works, each tool call is rendered in the live activity feed with a
plain-language label and an icon. `components/toolMap.ts` maps the agent's tool
names to that copy (some of it argument-aware) and a [lucide](https://lucide.dev)
icon. Unknown tools fall back to the `_default` row.

| Tool | Phase | Icon | Streamed copy (contextual variants in italics) |
| --- | --- | --- | --- |
| `get_prior_recipe` | research | `FileCode2` | Looking up your previous import setup |
| `search_prior_runs` | research | `Search` | Searching your past imports |
| `read_source_notes` | research | `BookOpen` | Reading what we already know about this source |
| `search_web` | research | `Globe` | Searching the web about this source · *Searching the web: "{query}"* |
| `read_url` | research | `BookOpen` | Reading a web page · *Reading {url}* |
| `remember_source_research` | research | `Save` | Saving what we learned about this source |
| `read_source` | research | `Table2` | Reading your uploaded files · *Reading "{fileName}"* |
| `query_source` | research | `FileSearch` | Analyzing your source data · *Analyzing the data in "{fileName}"* |
| `extract_tables` | research | `ScanText` | Extracting tables from your file · *Extracting tables from "{fileName}"* |
| `get_template` | research | `Table2` | Checking the target templates · *Checking {count} templates* · *Checking the {templateName} template* · *Checking the "{columnName}" column* |
| `write_recipe` | recipe | `Wand2` | Drafting the import |
| `view_recipe` | recipe | `FileText` | Reading the recipe · *Reading the recipe ({startLine}–{endLine})* |
| `find_in_recipe` | recipe | `Search` | Searching the recipe · *Finding "{query}" in the recipe* |
| `replace_lines` | recipe | `Pencil` | Editing the recipe · *Editing the recipe ({startLine}–{endLine})* |
| `str_replace_recipe` | recipe | `Pencil` | Editing the recipe |
| `dry_run` | recipe | `FlaskConical` | Testing the recipe on your data |
| `view_preview` | recipe | `Table2` | Reviewing the preview output |
| `ask_user` | hitl | `MessageCircleQuestion` | Asking you a question |
| `execute_import` | execute | `DatabaseZap` | Importing your data |
| `view_invalid_cells` | execute | `CircleAlert` | Checking which values need fixing · *Checking values that need fixing in "{columnName}"* |
| `profile_columns` | execute | `Columns3` | Checking which fields came across · *…came across in "{source}"* · *…landed in "{output}"* |
| `_default` | unknown | `Wrench` | Working |

## Project Shape

- `components/DemoApp.tsx`: the complete migration flow.
- `app/api/p/[slug]/vern/[...path]/route.ts`: Vern API proxy.
- `app/api/p/[slug]/sample-data/route.ts`: optional OpenAI sample-file generation.
- `lib/client.ts`: browser client for the local API routes.
- `lib/demo-config.ts`: server-side demo configuration.

## License

MIT
