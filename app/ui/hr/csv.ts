import { saveBlob } from '@/app/lib/download-file';

/**
 * A CSV of what a HR screen is showing (036 F9, F12, F17).
 *
 * Built in the browser from rows already loaded or fetched for the purpose, so an export never
 * needs its own endpoint. Every cell is quoted and inner quotes doubled (RFC 4180), and a cell that
 * starts with `= + - @` gets a leading apostrophe: Excel would otherwise run `=HYPERLINK(…)` typed
 * into an employee's name as a formula — CSV injection. A UTF-8 BOM makes Excel read ₹ and
 * Devanagari names correctly instead of as mojibake.
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
  saveBlob(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }), filename);
}
