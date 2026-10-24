'use client';

import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '@/app/lib/api/client';
import { listCompanyBranches } from '@/app/lib/api/company-branches';
import StatusBadge from '@/app/ui/status-badge';

/**
 * A company's branches, shown beneath its row in the companies list when the row is expanded (041).
 *
 * Read-only: adding, editing and moving the head office stay in the company's Edit → Branches tab.
 * Fetched on first expand and shared with that tab's query, so an edit there refreshes this too.
 */
export default function CompanyBranchRows({ companyId }: { companyId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['companies', companyId, 'branches'],
    queryFn: () => listCompanyBranches(companyId),
  });

  if (isLoading) {
    return <p className="py-2 pl-8 text-sm text-gray-500">Loading branches…</p>;
  }
  if (error) {
    return (
      <p className="py-2 pl-8 text-sm text-red-700">
        {errorMessage(error, 'Could not load the branches.')}
      </p>
    );
  }
  if (!data?.length) {
    return <p className="py-2 pl-8 text-sm text-gray-500">No branches recorded.</p>;
  }

  const status = (b: (typeof data)[number]) =>
    b.isHeadOffice ? (
      <StatusBadge label="Head office" tone="info" />
    ) : (
      <StatusBadge
        label={b.isActive ? 'Active' : 'Inactive'}
        tone={b.isActive ? 'success' : 'neutral'}
      />
    );

  return (
    <div className="rounded-lg border-l-4 border-brand-100 bg-gray-50 md:ml-6">
      {/* Phones: one block per branch, nothing to scroll sideways. */}
      <ul className="divide-y divide-gray-200 md:hidden">
        {data.map((b) => (
          <li key={b.id} className="space-y-1 px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{b.displayLabel}</span>
              {status(b)}
            </div>
            <p className="text-gray-600">
              {[b.address, b.pinCode].filter(Boolean).join(' – ') || '—'}
            </p>
            <p className="font-mono text-xs">{b.gstin ?? '—'}</p>
            <p className="text-xs text-gray-600">
              PF {b.pfEstablishmentCode ?? '—'} · ESIC {b.esicCode ?? '—'}
            </p>
          </li>
        ))}
      </ul>

      <table className="hidden w-full text-sm text-gray-800 md:table">
        <caption className="sr-only">Branches</caption>
        <thead className="text-left text-xs font-semibold text-gray-600">
          <tr>
            <th className="px-3 py-2">Branch</th>
            <th className="px-3 py-2">Address</th>
            <th className="px-3 py-2">GSTIN</th>
            <th className="px-3 py-2">PF / ESIC code</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.id} className="border-t border-gray-200 align-top">
              <td className="px-3 py-2 font-medium">{b.displayLabel}</td>
              <td className="px-3 py-2 text-gray-600">
                {[b.address, b.pinCode].filter(Boolean).join(' – ') || '—'}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{b.gstin ?? '—'}</td>
              <td className="whitespace-nowrap px-3 py-2 text-xs">
                <div>PF {b.pfEstablishmentCode ?? '—'}</div>
                <div className="text-gray-600">ESIC {b.esicCode ?? '—'}</div>
              </td>
              <td className="whitespace-nowrap px-3 py-2">{status(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
