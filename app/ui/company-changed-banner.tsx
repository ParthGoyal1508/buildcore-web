'use client';

import { ArrowPathIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
import { useSyncExternalStore } from 'react';

import { getCompanyChange, subscribeCompanyChange } from '@/app/lib/company-tab';

/**
 * "Company was changed to X in another tab." with Reload (036 B17).
 *
 * Persistent on purpose — no dismiss. Everything this tab has cached belongs to the old company,
 * and the server refuses its saves (409 `COMPANY_CHANGED`), so carrying on is not an option worth
 * offering; reloading picks up the company the session is now in. See `app/lib/company-tab.ts` for
 * how the change is detected.
 */
export default function CompanyChangedBanner() {
  const change = useSyncExternalStore(
    subscribeCompanyChange,
    getCompanyChange,
    () => null,
  );
  if (!change) return null;

  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[1150] flex flex-wrap items-center justify-center gap-3 bg-amber-100 px-4 py-2.5 text-sm text-amber-950 shadow-md"
    >
      <BuildingOffice2Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
      <p>
        {change.name
          ? `Company was changed to ${change.name} in another tab.`
          : 'Company was changed in another tab.'}{' '}
        Reload to continue.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-900"
      >
        <ArrowPathIcon aria-hidden="true" className="h-4 w-4" />
        Reload
      </button>
    </div>
  );
}
