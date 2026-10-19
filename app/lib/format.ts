import { BUSINESS_TIME_ZONE } from '@/app/lib/time-zone';

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
 * A unit rate, with the symbol — two decimals, and up to four where the quote derives it.
 *
 * `rupees` is fixed at two because money is counted in paise. **A rate is not money**: it is a
 * price per unit, and only the product of it and a quantity is ever paid. ₹178.00 at 10.79% below
 * is ₹158.7938, and printed as ₹158.79 it stops multiplying out to the amount beside it — which is
 * the only reason the column is on the page.
 */
export function unitRate(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

/**
 * A quantity rounded to two decimals, with Indian grouping (2026-10-15) — `807.4639999999999` →
 * `807.46`, `1420.855` → `1,420.86`, `326` → `326`. Stock figures are sums of three-decimal
 * Decimals added in floating point, and printed raw they read like a fault.
 */
export function quantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** A quantity to three decimals with Indian grouping — stock and measured work (036 A20). */
export function quantity3(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString('en-IN', { maximumFractionDigits: 3 });
}

/*
 * Dates (036 A18, decision 7: DD-MM-YYYY everywhere).
 *
 * These followed the browser's locale, so the same date read "Oct 16, 2026" on one laptop and
 * "16/10/2026" on the next, and 18 inline `toLocaleDateString` calls used five different locales
 * between them. Every date on screen now comes from here, and ESLint warns on a new inline one.
 *
 * - A date-only value (`2026-10-17`) is a calendar date, not an instant: it is rearranged as text,
 *   never put through a time zone that could move it a day.
 * - A timestamp is an instant: it is shown as the date and time it was **in India**
 *   (`BUSINESS_TIME_ZONE`), whatever zone the browser is in. A stored date column that arrives as
 *   midnight UTC (`2026-10-17T00:00:00.000Z`) stays on the 17th, since IST is ahead of UTC.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Year, month, day, hour and minute of an instant, in the business time zone. */
function businessParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function toDate(value: string | Date): Date | null {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "2026-07" → "July 2026". The API's period key is a sort key, not something to show a person. */
export function periodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  // A fixed locale (036 A18): the browser's own gave "juillet 2026" on a French-configured laptop.
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * "2026-09" → "Sep 2026", for a label too narrow for the full month.
 *
 * `en-US` for the month: `en-IN` and `en-GB` now abbreviate September to "Sept", the one month that
 * breaks a column of three-letter months.
 */
export function shortPeriodLabel(period: string): string {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** 1 → "January". For a month picker's options. */
export function monthName(month: number): string {
  return new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    timeZone: 'UTC',
  });
}

/** A date or a timestamp as `DD-MM-YYYY`. Blank renders as an em dash; unreadable, as it came. */
export function dateLabel(value: string | Date | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string') {
    const dateOnly = DATE_ONLY.exec(value);
    if (dateOnly) return `${dateOnly[3]}-${dateOnly[2]}-${dateOnly[1]}`;
  }
  const date = toDate(value);
  if (!date) return String(value);
  const { year, month, day } = businessParts(date);
  return `${day}-${month}-${year}`;
}

/** A timestamp as `DD-MM-YYYY HH:mm`, in India time — for audit trails where the minute matters. */
export function dateTimeLabel(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = toDate(value);
  if (!date) return String(value);
  const { year, month, day, hour, minute } = businessParts(date);
  return `${day}-${month}-${year} ${hour}:${minute}`;
}

/** A timestamp's time of day as `HH:mm`, in India time. */
export function clockTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = toDate(value);
  if (!date) return String(value);
  const { hour, minute } = businessParts(date);
  return `${hour}:${minute}`;
}

/**
 * "Friday, 17 October 2026" — a date written out as prose, for a heading or a greeting, never a
 * table or a form. `year: false` drops the year. A date-only value is read as that calendar day.
 */
export function longDateLabel(
  value: string | Date = new Date(),
  { year = true, weekday = true }: { year?: boolean; weekday?: boolean } = {},
): string {
  const dateOnly = typeof value === 'string' ? DATE_ONLY.exec(value) : null;
  const date = dateOnly
    ? new Date(
        Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])),
      )
    : toDate(value);
  if (!date) return String(value);
  return date.toLocaleDateString('en-IN', {
    ...(weekday ? { weekday: 'long' as const } : {}),
    day: 'numeric',
    month: 'long',
    ...(year ? { year: 'numeric' as const } : {}),
    timeZone: dateOnly ? 'UTC' : BUSINESS_TIME_ZONE,
  });
}

/** One part of a date-only value's calendar day — "Oct", "Friday" — for a date badge. */
export function datePart(
  value: string,
  part: 'monthShort' | 'weekday',
): string {
  const dateOnly = DATE_ONLY.exec(value.slice(0, 10));
  if (!dateOnly) return value;
  const date = new Date(
    Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])),
  );
  return date.toLocaleDateString(
    part === 'monthShort' ? 'en-US' : 'en-IN',
    part === 'monthShort'
      ? { month: 'short', timeZone: 'UTC' }
      : { weekday: 'long', timeZone: 'UTC' },
  );
}

/**
 * Today as `YYYY-MM-DD`, the format every date input and API filter here uses.
 *
 * In the business timezone, not UTC. `toISOString().slice(0, 10)` truncates an
 * instant in UTC, which at UTC+5:30 names *yesterday* between 00:00 and 05:30 IST —
 * so the attendance register opened on the wrong day, and any "not after today"
 * bound derived from it was a day out during the same window. Five screens seed a
 * date field from this helper, which is why the correction is made here rather than
 * at any one of them.
 *
 * `en-CA` because its short date format is already `YYYY-MM-DD`; the API's
 * `zonedDateOnly` picks that locale for the same reason, so the two produce the
 * same string.
 */
export function todayIso(): string {
  return businessDate(new Date());
}

/**
 * The `YYYY-MM-DD` date an instant falls on in the business timezone.
 *
 * For comparing a timestamp with `todayIso()`: slicing the ISO string of `2026-10-18T01:00+05:30`
 * gives the 17th, so an interview at 01:00 IST was neither "today" nor "upcoming" once today was
 * read in IST. Both sides of a comparison have to be in the same zone (036 A19).
 */
export function businessDate(instant: Date | string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof instant === 'string' ? new Date(instant) : instant);
}

/**
 * The current `YYYY-MM` period key, in the business timezone.
 *
 * Taken from `todayIso` for the reason that helper exists: the UTC slice it replaced named last
 * month between 00:00 and 05:30 IST on the 1st, so payroll, loans and advances opened on the wrong
 * period for the first hours of every month (036 A19).
 */
export function currentPeriod(): string {
  return todayIso().slice(0, 7);
}

/**
 * The Indian financial year containing a date, as `YYYY-YY` — April to March.
 *
 * TDS is declared, computed and filed per financial year, and getting the
 * boundary wrong puts a declaration in the wrong year rather than failing
 * visibly, so it is derived here once rather than in each screen.
 */
export function financialYearOf(date: Date = new Date()): string {
  const year =
    date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
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
