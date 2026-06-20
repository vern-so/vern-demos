# Contributing

Thanks for helping improve the Vern Migration Demo!

## Local setup

```bash
cp .env.local.example .env.local   # set VERN_API_KEY — the only required value
npm install
npm run dev                        # http://localhost:3000
```

Only `VERN_API_KEY` is required to run the demo. Everything else is optional and
documented in `.env.local.example`.

## Before opening a pull request

Run the same checks CI runs:

```bash
npx tsc --noEmit
npm run build
```

- Keep changes focused and match the surrounding code style.
- **Never commit secrets.** `.env*.local` is gitignored and secret push
  protection will block pushes that contain keys.
- If you change configuration, update `.env.local.example` and the README.

## How changes land

- Open PRs against `main`. Direct pushes to `main` are disabled.
- CI (typecheck + build) must pass before a PR can be merged.

## Reporting issues

Use the issue templates for bugs and feature requests. For security issues, see
[SECURITY.md](./SECURITY.md) — do not file them as public issues.
