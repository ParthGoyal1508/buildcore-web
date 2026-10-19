'use client';

import { currentPeriod, monthName } from '@/app/lib/format';
import { selectClass } from '@/app/ui/settings/form-fields';

/**
 * A month and year as two selects, for `YYYY-MM` (036 K16).
 *
 * `<input type="month">` is a text box in Safari and Firefox, where people typed "Oct 2026" and got
 * nothing back. Two selects work the same in every browser and on a phone. Years run from five back
 * to the current one; a month after the current one is not offered in the current year.
 */
export default function MonthSelect({
  id,
  label,
  value,
  onChange,
  allowFuture = false,
}: {
  id: string;
  label: string;
  /** `YYYY-MM`. */
  value: string;
  onChange: (value: string) => void;
  allowFuture?: boolean;
}) {
  const now = currentPeriod();
  const thisYear = Number(now.slice(0, 4));
  const thisMonth = Number(now.slice(5, 7));
  const [year, month] = (/^\d{4}-\d{2}$/.test(value) ? value : now)
    .split('-')
    .map(Number);
  const years = Array.from(
    { length: 6 + (allowFuture ? 1 : 0) },
    (_, i) => thisYear - 5 + i,
  ).reverse();
  const lastMonth = !allowFuture && year === thisYear ? thisMonth : 12;
  const join = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`;

  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </legend>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <select
          id={id}
          aria-label={`${label}: month`}
          className={selectClass}
          value={month}
          onChange={(event) => onChange(join(year, Number(event.target.value)))}
        >
          {Array.from({ length: lastMonth }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label}: year`}
          className={selectClass}
          value={year}
          onChange={(event) => {
            const y = Number(event.target.value);
            // Moving to the current year from a later month lands on this month, not a future one.
            const m =
              !allowFuture && y === thisYear ? Math.min(month, thisMonth) : month;
            onChange(join(y, m));
          }}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
