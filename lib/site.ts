// External links shown in the UI. NEXT_PUBLIC_* vars are inlined at build time
// so they're safe to read on the client. Defaults point at Vern; override per fork.

export const SOURCE_URL =
  process.env.NEXT_PUBLIC_SOURCE_URL || "https://github.com/vern-so/vern-demos";

export const BOOK_A_CALL_URL =
  process.env.NEXT_PUBLIC_BOOK_A_CALL_URL || "https://cal.com/vishvarma/30min";

export const DOCS_URL = "https://docs.vern.so/migration-api/introduction";
