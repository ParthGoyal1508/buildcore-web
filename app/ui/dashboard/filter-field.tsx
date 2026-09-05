'use client';

import type { FilterSpec } from '@/app/lib/api/dashboard';

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
  const inputClass =
    'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <label className="block text-sm">
      <span className="text-gray-700">
        {spec.label}
        {spec.required && <span className="text-red-500"> *</span>}
      </span>
      {spec.type === 'select' ? (
        <select
          className={inputClass}
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
          className={inputClass}
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
