'use client';

import clsx from 'clsx';

import type { FilterSpec } from '@/app/lib/api/dashboard';
import { fieldClass, selectClass } from '@/app/ui/settings/form-fields';

/**
 * Renders one report filter from its {@link FilterSpec} (spec FR-013). Native
 * `<label>`/`<select>`/`<input>` elements, fully keyboard-operable (spec FR-019); a
 * new filter type needs one more case here, not a new form.
 */
export default function FilterField({
  spec,
  value,
  onChange,
}: {
  spec: FilterSpec;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-gray-700">
        {spec.label}
        {spec.required && <span className="text-red-500"> *</span>}
      </span>
      {spec.type === 'select' ? (
        <select
          className={clsx('mt-1', selectClass)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">All</option>
          {(spec.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={clsx('mt-1', fieldClass)}
          type={
            spec.type === 'date' || spec.type === 'dateRange' ? 'date' : 'text'
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
