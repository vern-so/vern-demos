// Normalizes the live Vern /preview response into a render model.
//
// Verified live shape (staging):
//   { status, templates:[{slug,name}], sheets:[ { template:{slug,name},
//     rows: [ [<header col names>], [<row values>], ... ],   // row[0] is the header
//     invalid_cells: [ ... ] } ] }
// Cells are plain strings; the agent self-heals and records originals in `notes`.
// `invalid_cells` lists cells that failed validation (empty when all healed).

export type Cell = { value: string; valid: boolean; message?: string | null };
export type PreviewRow = { cells: Cell[] };
export type PreviewSheet = {
  slug: string;
  name: string;
  columns: string[];
  rows: PreviewRow[];
  total: number; // total data row count (may exceed rows shown)
  invalidCells: number;
};

const MAX_ROWS = 200;

export function normalizePreview(data: unknown): PreviewSheet[] {
  const root = data as Record<string, unknown> | null;
  const sheets = root && Array.isArray(root.sheets) ? root.sheets : null;
  if (!sheets) return [];
  return sheets.map((s, i) => normalizeSheet(s, i)).filter(Boolean) as PreviewSheet[];
}

function normalizeSheet(raw: unknown, index: number): PreviewSheet | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const tpl = (s.template as Record<string, unknown>) || {};

  const slug = str(tpl.slug) || str(s.slug) || `sheet-${index + 1}`;
  const name = str(tpl.name) || str(s.name) || titleize(slug);

  const rawRows = Array.isArray(s.rows) ? s.rows : [];

  // Primary shape: header-first array-of-arrays.
  let columns: string[] = [];
  let dataRows: unknown[] = [];
  if (rawRows.length && Array.isArray(rawRows[0])) {
    columns = (rawRows[0] as unknown[]).map(stringifyValue);
    dataRows = rawRows.slice(1);
  } else if (rawRows.length && isPlainObject(rawRows[0])) {
    // Fallback: array of objects keyed by column.
    columns =
      (asArray(s.columns) || [])
        .map((c) => (typeof c === "string" ? c : str((c as Record<string, unknown>)?.name)))
        .filter(Boolean) as string[];
    if (columns.length === 0) columns = Object.keys(rawRows[0] as Record<string, unknown>);
    dataRows = rawRows;
  }

  const invalid = buildInvalidIndex(s.invalid_cells, columns);

  const rows: PreviewRow[] = dataRows.slice(0, MAX_ROWS).map((r, ri) => ({
    cells: columns.map((col, ci) => {
      const value = stringifyValue(Array.isArray(r) ? r[ci] : (r as Record<string, unknown>)?.[col]);
      const msg = invalid.get(`${ri}:${ci}`) ?? invalid.get(`${ri}:${col}`);
      return { value, valid: msg === undefined, message: msg ?? null };
    }),
  }));

  const invalidCells = Array.isArray(s.invalid_cells) ? s.invalid_cells.length : 0;

  return { slug, name, columns, rows, total: dataRows.length, invalidCells };
}

// invalid_cells element shape isn't fully pinned (empty when the agent heals all),
// so read its row/column reference defensively.
function buildInvalidIndex(raw: unknown, columns: string[]): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(raw)) return map;
  for (const item of raw) {
    if (!isPlainObject(item)) continue;
    const o = item as Record<string, unknown>;
    const row = num(o.row) ?? num(o.rowIndex) ?? num(o.r) ?? num(o.rowNumber);
    if (row === undefined) continue;
    const message = str(o.message) || str(o.reason) || str(o.error) || "Flagged by validation";
    const colName = str(o.column) || str(o.columnName) || str(o.col);
    const colIdx = num(o.colIndex) ?? num(o.columnIndex) ?? (colName ? columns.indexOf(colName) : -1);
    if (colName) map.set(`${row}:${colName}`, message);
    if (colIdx >= 0) map.set(`${row}:${colIdx}`, message);
  }
  return map;
}

// ---- helpers ----
function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null;
}
function isPlainObject(v: unknown): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function titleize(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
