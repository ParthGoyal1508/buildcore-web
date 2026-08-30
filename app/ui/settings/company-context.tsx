'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useState } from 'react';
import { listActiveCompanies } from '@/app/lib/api/settings';
import { getCurrentUser } from '@/app/lib/api/users';

interface CompanyContextValue {
  /** The company the Employee Setup tabs are currently scoped to. */
  companyId: string | null;
  setCompanyId: (id: string) => void;
  /** True when the signed-in user may look at companies other than their own. */
  canSwitch: boolean;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function useCompanyContext(): CompanyContextValue {
  const value = useContext(CompanyContext);
  if (!value) {
    throw new Error('useCompanyContext must be used inside <CompanyProvider>');
  }
  return value;
}

/**
 * Scopes the Employee Setup tabs to one company (research.md §6).
 *
 * Defaults to the signed-in user's own company. A cross-company Super Admin has no
 * `companyId` of their own to fall back on, so they get the selector below and the
 * first active company as a starting point — without it, their reference-data lists
 * would show every company's rows mixed together.
 */
export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });
  const canSwitch = !!user?.permissions.includes('CROSS_COMPANY_ACCESS');

  // Only fetched for a caller who can actually act on the result.
  const { data: companies } = useQuery({
    queryKey: ['companies', 'active'],
    queryFn: listActiveCompanies,
    enabled: canSwitch,
  });

  const value = useMemo<CompanyContextValue>(
    () => ({
      companyId: selected ?? companies?.[0]?.id ?? null,
      setCompanyId: setSelected,
      canSwitch,
    }),
    [selected, companies, canSwitch],
  );

  return (
    <CompanyContext.Provider value={value}>
      {canSwitch && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label
            htmlFor="company-selector"
            className="text-sm font-medium text-gray-700"
          >
            Company
          </label>
          <select
            id="company-selector"
            value={value.companyId ?? ''}
            onChange={(event) => setSelected(event.target.value)}
            className="rounded-md border border-gray-200 py-2 pl-3 pr-8 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {(companies ?? []).map((company) => (
              <option key={company.id} value={company.id}>
                {company.name} ({company.shortCode})
              </option>
            ))}
          </select>
        </div>
      )}
      {children}
    </CompanyContext.Provider>
  );
}
