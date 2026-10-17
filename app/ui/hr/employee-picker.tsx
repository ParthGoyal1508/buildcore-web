'use client';

import { useId, useState } from 'react';

import { listEmployees, type Employee } from '@/app/lib/api/hr-payroll';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';

const nameOf = (employee: Employee) =>
  [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();

/** An employee as a picker row: code first, name under it. */
export const employeeOption = (employee: Employee): SearchableOption => ({
  id: employee.id,
  label: employee.employeeCode,
  sublabel: nameOf(employee) || undefined,
  note: employee.isActive ? undefined : 'Left',
});

/**
 * The HR employee picker (036 F13): searches the server as you type.
 *
 * Loans, advances, TDS, Form 16 and leave balances each loaded `pageSize: 100` into a `<select>`,
 * leavers included, so the 101st employee could not be chosen at all and a person who had left
 * could be lent money. Here every search asks `GET /hr/employees?search=` for **active** employees;
 * `allowLeavers` adds a "Show leavers" switch for the screens where a leaver is a legitimate
 * choice (Form 16 and tax declarations are owed for the year they worked).
 */
export default function EmployeePicker({
  id,
  label,
  value,
  onChange,
  selected,
  allowLeavers = false,
  required = false,
  disabled = false,
  emptyLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (employeeId: string, employee: SearchableOption | null) => void;
  /** The current value's row, when the form opens on an existing record. */
  selected?: SearchableOption | null;
  allowLeavers?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Offered first, selecting `''` — "All employees" on a filter. Omit for a mandatory choice. */
  emptyLabel?: string;
}) {
  const [leavers, setLeavers] = useState(false);
  const leaversId = useId();
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
          {required && (
            <span className="ml-0.5 text-red-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {allowLeavers && (
          <label
            htmlFor={leaversId}
            className="flex items-center gap-1.5 text-xs text-gray-600"
          >
            <input
              id={leaversId}
              type="checkbox"
              checked={leavers}
              onChange={(event) => setLeavers(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            Show leavers
          </label>
        )}
      </div>
      <AsyncSelect
        id={id}
        value={value}
        onChange={onChange}
        selectedOption={selected}
        emptyLabel={emptyLabel}
        disabled={disabled}
        placeholder="Type a name or code"
        cacheKey={['hr', 'employee-picker', leavers ? 'leavers' : 'active']}
        search={(term, page) =>
          listEmployees({
            search: term || undefined,
            page,
            pageSize: 25,
            isActive: !leavers,
          }).then((result) => ({
            items: result.items.map(employeeOption),
            total: result.total,
          }))
        }
      />
    </div>
  );
}
