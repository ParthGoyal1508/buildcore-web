'use client';

import { currentPeriod, todayIso } from '@/app/lib/format';
import { fieldClass, inlineSelectClass } from '@/app/ui/settings/form-fields';

/**
 * A date filter with month presets, a month picker and a custom range (036 D1, E3).
 *
 * The approval history had no date filter at all and the activity log only fixed windows ("last 7
 * days"), so "what was approved in September" or "who changed this between the 3rd and the 9th"
 * could not be asked. The presets cover the common questions in one tap; the month picker and the
 * range cover the rest.
 *
 * The state is three plain strings so a screen can keep them in the URL (`useUrlState`) and the
 * values become `from`/`to` (inclusive `YYYY-MM-DD`, business timezone) through `rangeOf`.
 */
export const RANGE_PRESETS = [
  'all',
  'this-month',
  'last-month',
  'last-3-months',
  'month',
  'custom',
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

const PRESET_LABELS: Record<RangePreset, string> = {
  all: 'Any date',
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-3-months': 'Last 3 months',
  month: 'Choose a month…',
  custom: 'Custom range…',
};

/** `YYYY-MM` shifted by `by` months. */
function shiftMonth(period: string, by: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(period: string): { from: string; to: string } {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, '0')}` };
}

const MONTH = /^\d{4}-\d{2}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The inclusive `from`/`to` a preset means, or an `error` that stops the query — a From after its
 * To is refused here before the server has to (it refuses too).
 */
export function rangeOf(state: {
  preset: RangePreset;
  month: string;
  from: string;
  to: string;
}): { from?: string; to?: string; error?: string } {
  const now = currentPeriod();
  switch (state.preset) {
    case 'all':
      return {};
    case 'this-month':
      return { from: monthBounds(now).from, to: todayIso() };
    case 'last-month':
      return monthBounds(shiftMonth(now, -1));
    case 'last-3-months':
      return { from: monthBounds(shiftMonth(now, -2)).from, to: todayIso() };
    case 'month':
      return MONTH.test(state.month) ? monthBounds(state.month) : {};
    case 'custom': {
      const from = DAY.test(state.from) ? state.from : undefined;
      const to = DAY.test(state.to) ? state.to : undefined;
      if (from && to && from > to) {
        return { error: 'The From date must not be after the To date.' };
      }
      return { from, to };
    }
  }
}

export default function DateRangeFilter({
  idPrefix,
  preset,
  month,
  from,
  to,
  onChange,
  error,
}: {
  idPrefix: string;
  preset: RangePreset;
  month: string;
  from: string;
  to: string;
  onChange: (patch: Partial<{ preset: RangePreset; month: string; from: string; to: string }>) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm" htmlFor={`${idPrefix}-preset`}>
        <span className="mb-1 block text-gray-700">Date</span>
        <select
          id={`${idPrefix}-preset`}
          className={inlineSelectClass}
          value={preset}
          onChange={(e) => {
            const next = e.target.value as RangePreset;
            onChange({
              preset: next,
              // A useful starting point rather than an empty box.
              ...(next === 'month' && !month ? { month: currentPeriod() } : {}),
            });
          }}
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      {preset === 'month' && (
        <label className="text-sm" htmlFor={`${idPrefix}-month`}>
          <span className="mb-1 block text-gray-700">Month</span>
          <input
            id={`${idPrefix}-month`}
            type="month"
            className={fieldClass}
            value={month}
            max={currentPeriod()}
            onChange={(e) => onChange({ month: e.target.value })}
          />
        </label>
      )}
      {preset === 'custom' && (
        <>
          <label className="text-sm" htmlFor={`${idPrefix}-from`}>
            <span className="mb-1 block text-gray-700">From</span>
            <input
              id={`${idPrefix}-from`}
              type="date"
              className={fieldClass}
              value={from}
              max={to || todayIso()}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${idPrefix}-range-error` : undefined}
              onChange={(e) => onChange({ from: e.target.value })}
            />
          </label>
          <label className="text-sm" htmlFor={`${idPrefix}-to`}>
            <span className="mb-1 block text-gray-700">To</span>
            <input
              id={`${idPrefix}-to`}
              type="date"
              className={fieldClass}
              value={to}
              min={from || undefined}
              max={todayIso()}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${idPrefix}-range-error` : undefined}
              onChange={(e) => onChange({ to: e.target.value })}
            />
          </label>
        </>
      )}
      {error && (
        <p
          id={`${idPrefix}-range-error`}
          className="w-full text-xs text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
