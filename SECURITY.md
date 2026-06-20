# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub's [private vulnerability reporting](https://github.com/vern-so/migration-harness-demo/security/advisories/new)
— the **Security → Report a vulnerability** button on this repo. We aim to
acknowledge reports within 3 business days.

## Scope

This is a demo UI for the [Vern Migration API](https://docs.vern.so/migration-api/introduction).
The most sensitive concern is credential handling:

- The browser never receives the Vern API key — every Vern request is proxied
  server-side, with the key injected in the API route.
- Real keys must never be committed. `.env*.local` is gitignored and secret
  push protection is enabled on this repo.

If you find a way an API key (or any secret) could leak to the client or into
the repository, please report it through the channel above.
