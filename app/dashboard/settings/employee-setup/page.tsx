'use client';

import { Suspense, useId } from 'react';
import { urlEnum, useUrlState } from '@/app/lib/use-url-state';
import CodeSeriesTab from '@/app/ui/settings/code-series-tab';
import DepartmentTab from '@/app/ui/settings/department-tab';
import DesignationTab from '@/app/ui/settings/designation-tab';
import DocumentTypeTab from '@/app/ui/settings/document-type-tab';
import ShiftTab from '@/app/ui/settings/shift-tab';
import PageHeader from '@/app/ui/page-header';

const TABS = [
  { id: 'departments', label: 'Departments', render: () => <DepartmentTab /> },
  { id: 'designations', label: 'Designations', render: () => <DesignationTab /> },
  { id: 'document-types', label: 'Document Types', render: () => <DocumentTypeTab /> },
  { id: 'shifts', label: 'Shifts', render: () => <ShiftTab /> },
  { id: 'code-series', label: 'Code Series', render: () => <CodeSeriesTab /> },
] as const;

const TAB_IDS = TABS.map((tab) => tab.id) as [
  (typeof TABS)[number]['id'],
  ...(typeof TABS)[number]['id'][],
];

/**
 * The five per-company Employee Setup masters.
 *
 * All five read the company from the session, so switching company in the header
 * re-scopes every tab at once rather than each keeping its own idea of which
 * company is in view.
 */
export default function EmployeeSetupPage() {
  return (
    // The tab lives in the URL (`?tab=`), which reads `useSearchParams` (036 C16).
    <Suspense>
      <EmployeeSetup />
    </Suspense>
  );
}

/**
 * 036 C16: the open tab is in the URL, so Back, a refresh and a shared link land on it; and the
 * strip is a real ARIA tab set — each tab names its panel, the panel names its tab, and the arrow
 * keys move between tabs.
 */
function EmployeeSetup() {
  const [{ tab: active }, setUrl] = useUrlState({
    tab: urlEnum(TAB_IDS, 'departments'),
  });
  const current = TABS.find((tab) => tab.id === active) ?? TABS[0];
  const base = useId();
  const tabId = (id: string) => `${base}-tab-${id}`;
  const panelId = (id: string) => `${base}-panel-${id}`;

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((tab) => tab.id === active);
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length];
    setUrl({ tab: next.id });
    document.getElementById(tabId(next.id))?.focus();
  };

  return (
    <main>
      <PageHeader title="Employee Setup" className="mb-6" />

      <div
        role="tablist"
        aria-label="Employee setup sections"
        className="mb-4 flex flex-wrap gap-1 overflow-x-auto border-b"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={tabId(tab.id)}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={panelId(tab.id)}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setUrl({ tab: tab.id })}
            onKeyDown={onKeyDown}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 ${
              active === tab.id
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={panelId(current.id)}
        aria-labelledby={tabId(current.id)}
        tabIndex={0}
      >
        {current.render()}
      </div>
    </main>
  );
}
