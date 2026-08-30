'use client';

import { useQuery } from '@tanstack/react-query';
import { getCodeSeries } from '@/app/lib/api/settings';
import { MESSAGES } from '@/app/lib/constants';
import { useCompanyContext } from '@/app/ui/settings/company-context';

/**
 * Read-only view of a company's employee code series (spec FR-019).
 *
 * Deliberately has no editable sequence field: the counter is allocated atomically
 * by the API when an employee is created, and letting an admin set it by hand would
 * be a way to mint duplicate codes. Reading it never consumes a number.
 */
export default function CodeSeriesTab() {
  const { companyId } = useCompanyContext();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['code-series', companyId],
    queryFn: () => getCodeSeries(companyId as string),
    enabled: !!companyId,
  });

  if (!companyId) {
    return <p className="p-4 text-sm text-gray-500">Select a company first.</p>;
  }
  if (isLoading) {
    return (
      <p className="p-4 text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (isError || !data) {
    return (
      <p className="p-4 text-sm text-red-600" role="alert">
        {MESSAGES.loadFailed}
      </p>
    );
  }

  return (
    <dl className="grid gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-3">
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Short code
        </dt>
        <dd className="mt-1 text-lg font-medium text-gray-900">{data.shortCode}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Codes issued
        </dt>
        <dd className="mt-1 text-lg font-medium text-gray-900">{data.lastNumber}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Next employee code
        </dt>
        <dd className="mt-1 text-lg font-medium text-gray-900">{data.nextCode}</dd>
      </div>
      <p className="text-xs text-gray-500 sm:col-span-3">
        Editing the company&apos;s short code changes the prefix of future codes only —
        the sequence continues from where it left off.
      </p>
    </dl>
  );
}
