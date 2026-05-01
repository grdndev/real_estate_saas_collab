/** Échappe une cellule pour le CSV (RFC 4180 + BOM UTF-8 pour Excel). */
function escape(cell: string | number | null | undefined): string {
  const s = cell == null ? "" : String(cell);
  if (
    s.includes(",") ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes(";")
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [
    headers.map(escape).join(";"),
    ...rows.map((r) => r.map(escape).join(";")),
  ];
  // BOM UTF-8 pour Excel — accents OK.
  return "﻿" + lines.join("\r\n");
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
