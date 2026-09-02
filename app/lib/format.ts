/**
 * Display formatting shared between My Workspace and HR & Payroll.
 *
 * Extracted from `app/ui/my/salary-slip.tsx`, which had the only copies. Both
 * features render the same money and the same period keys, and two independent
 * implementations of "₹" placement or "2026-07" → "July 2026" would drift the
 * first time either was touched.
 */

/** Indian-format amount, always to two decimals. Never prefixed — callers decide. */
export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** With the currency symbol, for a figure standing on its own. */
export function rupees(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `₹${money(value)}`;
}

/**
 * "2026-07" → "July 2026".
 *
 * The API's period key is a sort key, not something to put in front of a person.
 */
export function periodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** An ISO date (or date-time) as a short local date. Blank input renders as an em dash. */
export function dateLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** An ISO timestamp as date + time, for audit trails where the minute matters. */
export function dateTimeLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}, ${date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

/** Today as `YYYY-MM-DD`, the format every date input and API filter here uses. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The current `YYYY-MM` period key. */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * The Indian financial year containing a date, as `YYYY-YY` — April to March.
 *
 * TDS is declared, computed and filed per financial year, and getting the
 * boundary wrong puts a declaration in the wrong year rather than failing
 * visibly, so it is derived here once rather than in each screen.
 */
export function financialYearOf(date: Date = new Date()): string {
  const year = date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, '0')}`;
}

/**
 * A punch time as `HH:mm`, whatever form the API sent.
 *
 * The backend has two producers and they disagree: the daily register emits
 * `"03:49"`, while the attendance history emits a full ISO timestamp. Rendering
 * the second one raw put `2026-09-02T03:49:41.002Z` in a column headed "In".
 * ISO values are read in UTC, matching how the register derives its own `HH:mm`
 * from the same instant.
 */
export function timeLabel(value: string | null | undefined): string {
  if (!value) return '—';
  if (!value.includes('T')) {
    const short = /^(\d{1,2}):(\d{2})/.exec(value);
    if (short) return `${short[1].padStart(2, '0')}:${short[2]}`;
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${String(parsed.getUTCHours()).padStart(2, '0')}:${String(
    parsed.getUTCMinutes(),
  ).padStart(2, '0')}`;
}
