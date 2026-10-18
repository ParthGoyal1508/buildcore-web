'use client';

import { useEffect } from 'react';

import { useSelectedCompany } from '@/app/lib/api/company-selection';
import { TextField } from '@/app/ui/settings/form-fields';

export const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** `YYYY-MM` → `{ year, month }`. */
export function yearMonthOf(value: string): { year: number; month: number } {
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

/**
 * Month and Year for a company download (2026-10-17), and the company it is for.
 *
 * The company is the one selected in the header — never a second picker here. A Company dropdown
 * beside a header that already names a company asked the same question twice and allowed two
 * different answers (036 follow-up, 2026-10-18). Someone who works across companies switches in
 * the header; the form names the company so it is plain which file they will get.
 */
export function CompanyMonthFields({
  idPrefix,
  month,
  onMonth,
  companyId,
  onCompany,
}: {
  idPrefix: string;
  month: string;
  onMonth: (value: string) => void;
  companyId: string;
  onCompany: (value: string) => void;
}) {
  const selected = useSelectedCompany();
  useEffect(() => {
    if (selected && selected.id !== companyId) onCompany(selected.id);
  }, [selected, companyId, onCompany]);
  return (
    <>
      <TextField
        id={`${idPrefix}-month`}
        label="Month and year"
        type="month"
        value={month}
        max={thisMonth()}
        onChange={(e) => onMonth(e.target.value)}
      />
      {selected && (
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">Company</span>
          <span className="flex min-h-10 items-center text-gray-900">
            {selected.name}
          </span>
          <span className="text-xs text-gray-500">
            Change the company from the header.
          </span>
        </div>
      )}
    </>
  );
}
