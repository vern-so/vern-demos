# Vern Migration Demo

An embeddable UI for the [Vern Migration API](https://docs.vern.so/migration-api/introduction).
Drop in messy CSV, Excel, or PDF exports and watch Vern map, validate, preview, and import the
data inside a product-style workflow.

The point of this demo is simple: messy customer data should feel easy to migrate.

## What It Shows

- **Messy files in**: renamed headers, missing values, duplicates, PDFs, spreadsheets, and rough exports.
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

Import the repo into Vercel and set the required API key:

| Key | Required | Purpose |
| --- | --- | --- |
| `VERN_API_KEY` | Yes | Authenticates requests to Vern. |
| `OPENAI_API_KEY` | No | Enables generated sample files. |

Optional API settings:

| Key | Purpose |
| --- | --- |
| `VERN_API_BASE` | Override the Vern API base URL. |
| `VERN_PROTECTION_BYPASS` | Use only for protected staging APIs. |
| `OPENAI_SAMPLE_MODEL` | Override the sample-generation model. |

Optional UI links:

| Key | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SOURCE_URL` | Header "View source" link. |
| `NEXT_PUBLIC_BOOK_A_CALL_URL` | Done-screen CTA link. |

Branding and access-gate variables are shown in `.env.local.example` for local customization, but
you only need `VERN_API_KEY` to run the demo.

## Project Shape

- `components/DemoApp.tsx`: the complete migration flow.
- `app/api/p/[slug]/vern/[...path]/route.ts`: Vern API proxy.
- `app/api/p/[slug]/sample-data/route.ts`: optional OpenAI sample-file generation.
- `lib/client.ts`: browser client for the local API routes.
- `lib/demo-config.ts`: server-side demo configuration.

## License

MIT
