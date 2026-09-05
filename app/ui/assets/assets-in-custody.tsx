'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getAllocations } from '@/app/lib/api/assets';
import { MESSAGES, ROUTES, formatAssetQuantity } from '@/app/lib/constants';

/**
 * What one employee is currently holding (spec FR-028).
 *
 * Written as a self-contained panel so 005's employee screen can mount it with one
 * line and no knowledge of this module's shapes — the coordination point its own
 * FR-040 amendment describes. It renders nothing at all when the person holds
 * nothing, so mounting it on every employee costs an empty query and no chrome.
 *
 * Deliberately read-only. Returning an asset is a store action taken against the
 * allocation, not an HR action taken against the person, and putting a Return button
 * on an employee record would invite it to be used as an exit checklist.
 */
export default function AssetsInCustody({
  employeeId,
  companyId,
}: {
  employeeId: string;
  companyId?: string;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['assets', 'custody', employeeId, companyId],
    queryFn: () =>
      getAllocations({
        custodianEmployeeId: employeeId,
        status: 'open',
        pageSize: 100,
        ...(companyId ? { companyId } : {}),
      }),
    select: (page) => page.items,
  });

  if (isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        Loading assets in custody…
      </p>
    );
  }
  if (isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {MESSAGES.assetsLoadFailed}
      </p>
    );
  }
  if (!data || data.length === 0) return null;

  const overdue = data.filter((entry) => entry.overdue).length;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">
        Assets in custody ({data.length})
        {overdue > 0 && (
          <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
            {overdue} overdue
          </span>
        )}
      </h2>
      <ul className="mt-3 divide-y divide-gray-100">
        {data.map((entry) => (
          <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span className="text-sm text-gray-900">
              <Link
                href={ROUTES.assetsAsset(entry.assetId)}
                className="text-blue-700 underline hover:text-blue-900"
              >
                {entry.assetCode}
              </Link>{' '}
              {entry.assetName}
              {entry.quantity !== 1 && (
                <span className="text-gray-600">
                  {' '}
                  · {formatAssetQuantity(entry.quantity, null)}
                </span>
              )}
            </span>
            <span
              className={`text-sm ${entry.overdue ? 'text-red-700' : 'text-gray-600'}`}
            >
              {entry.siteName} · due {entry.expectedReturnDate.slice(0, 10)}
              {entry.overdue ? ` (${entry.daysOverdue}d over)` : ''}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
