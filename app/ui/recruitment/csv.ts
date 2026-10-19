import { saveBlob } from '@/app/lib/download-file';

/**
 * A report's rows saved as a CSV the reader can open in Excel (036 H5). Built in the browser from
 * what is already on screen, so the file says exactly what the table said.
 *
 * Quoted where a value holds a comma, quote or line break; a leading `= + - @` is prefixed with `'`
 * so a candidate named "=HYPERLINK(…)" opens as text, not a formula. The BOM makes Excel read it as
 * UTF-8 — the rupee sign and Hindi names arrive intact.
 */
export function downloadCsv(
  filename: string,
  rows: (string | number | null | undefined)[][],
) {
  const cell = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const body = rows.map((row) => row.map(cell).join(',')).join('\r\n');
  saveBlob(
    new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' }),
    filename,
  );
}
