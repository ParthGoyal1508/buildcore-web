'use client';

import type { ReportType } from '@/app/lib/api/dashboard';

/**
 * The report-type picker (spec FR-012). Available types are selectable; unavailable
 * ones show a "Coming soon" badge and cannot be run. Native buttons, keyboard-operable
 * (spec FR-019).
 */
export default function ReportTypeList({
  types,
  selectedId,
  onSelect,
}: {
  types: ReportType[];
  selectedId: string | null;
  onSelect: (type: ReportType) => void;
}) {
  return (
    <ul className="space-y-2">
      {types.map((type) => {
        const selected = type.id === selectedId;
        return (
          <li key={type.id}>
            <button
              onClick={() => type.isAvailable && onSelect(type)}
              disabled={!type.isAvailable}
              aria-pressed={selected}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                selected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              } ${type.isAvailable ? '' : 'cursor-not-allowed opacity-70'}`}
            >
              <span className="font-medium text-gray-900">{type.name}</span>
              {!type.isAvailable && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                  Coming soon
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
