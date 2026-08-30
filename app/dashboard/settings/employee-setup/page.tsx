'use client';

import { useState } from 'react';
import { lusitana } from '@/app/ui/fonts';
import { CompanyProvider } from '@/app/ui/settings/company-context';
import CodeSeriesTab from '@/app/ui/settings/code-series-tab';
import DepartmentTab from '@/app/ui/settings/department-tab';
import DesignationTab from '@/app/ui/settings/designation-tab';
import DocumentTypeTab from '@/app/ui/settings/document-type-tab';
import ShiftTab from '@/app/ui/settings/shift-tab';

const TABS = [
  { id: 'departments', label: 'Departments', render: () => <DepartmentTab /> },
  { id: 'designations', label: 'Designations', render: () => <DesignationTab /> },
  { id: 'document-types', label: 'Document Types', render: () => <DocumentTypeTab /> },
  { id: 'shifts', label: 'Shifts', render: () => <ShiftTab /> },
  { id: 'code-series', label: 'Code Series', render: () => <CodeSeriesTab /> },
] as const;

/**
 * The five per-company Employee Setup masters.
 *
 * All five live under one `CompanyProvider`, so switching company in the selector
 * re-scopes every tab at once rather than each keeping its own idea of which
 * company is in view.
 */
export default function EmployeeSetupPage() {
  const [active, setActive] = useState<(typeof TABS)[number]['id']>('departments');
  const current = TABS.find((tab) => tab.id === active) ?? TABS[0];

  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Employee Setup</h1>

      <CompanyProvider>
        <div
          role="tablist"
          aria-label="Employee setup sections"
          className="mb-4 flex flex-wrap gap-1 overflow-x-auto border-b"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              onClick={() => setActive(tab.id)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                active === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {current.render()}
      </CompanyProvider>
    </main>
  );
}
