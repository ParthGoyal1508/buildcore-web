'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import { listActiveCompanies } from '@/app/lib/api/settings';
import { getCurrentUser } from '@/app/lib/api/users';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';

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
 * Month and Year, and Company for someone who works across companies (2026-10-17). Everyone else
 * works in their own company, which the server applies, so they are not asked.
 *
 * The company is always a named one, starting on the company selected in the header (or the first
 * company when none is): "the company I am working in" left people guessing which file they would
 * get.
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
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const crossCompany = user.data?.permissions.includes('CROSS_COMPANY_ACCESS') ?? false;
  const companies = useQuery({
    queryKey: ['settings', 'companies', 'active'],
    queryFn: listActiveCompanies,
    enabled: crossCompany,
  });
  const selected = useSelectedCompanyId();
  useEffect(() => {
    if (!crossCompany || companyId || !companies.data?.length) return;
    const start =
      companies.data.find((c) => c.id === selected)?.id ?? companies.data[0].id;
    onCompany(start);
  }, [crossCompany, companyId, companies.data, selected, onCompany]);
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
      {crossCompany && (
        <SelectField
          id={`${idPrefix}-company`}
          label="Company"
          value={companyId}
          onChange={(e) => onCompany(e.target.value)}
        >
          {!companyId && <option value="">Loading companies…</option>}
          {companies.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      )}
    </>
  );
}
