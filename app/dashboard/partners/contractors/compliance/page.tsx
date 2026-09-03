'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  MonthlyCompliance,
  getCompliance,
  verifyCompliance,
} from '@/app/lib/api/partners';
import { MESSAGES } from '@/app/lib/constants';
import { dateLabel, money, periodLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { lusitana } from '@/app/ui/fonts';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import ComplianceModal from '@/app/ui/partners/compliance-modal';

function CompliancePageBody() {
  const searchParams = useSearchParams();
  const contractorId = searchParams.get('contractorId') ?? undefined;
  const month = searchParams.get('month') ?? undefined;

  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const filters = { contractorProfileId: contractorId, month };

  const { data, isPending, isError } = useQuery({
    queryKey: ['partners', 'compliance', filters],
    queryFn: () => getCompliance(filters),
  });

  const verify = useMutation({
    mutationFn: (id: string) => verifyCompliance(id),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['partners', 'compliance'] });
      // The contractor's own status is recomputed server-side by the same
      // transaction, so its badge elsewhere is stale until this is invalidated.
      queryClient.invalidateQueries({ queryKey: ['partners', 'contractors'] });
      queryClient.invalidateQueries({ queryKey: ['partners', 'contractor'] });
    },
    onError: (err: unknown) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.saveFailed),
  });

  const columns: Column<MonthlyCompliance>[] = [
    {
      key: 'contractor',
      header: 'Contractor',
      sticky: true,
      render: (row) => (
        <span className="font-medium text-gray-900">
          {row.contractorName ?? row.contractorProfileId}
        </span>
      ),
    },
    { key: 'month', header: 'Month', render: (row) => periodLabel(row.month) },
    {
      key: 'pf',
      header: 'PF challan',
      render: (row) =>
        row.pfChallanNumber ? (
          <div>
            <p>{row.pfChallanNumber}</p>
            <p className="text-xs text-gray-500">
              {money(row.pfAmount)} · {dateLabel(row.pfDate)}
            </p>
          </div>
        ) : (
          <span className="text-gray-400">Not filed</span>
        ),
    },
    {
      key: 'esic',
      header: 'ESIC challan',
      render: (row) =>
        row.esicChallanNumber ? (
          <div>
            <p>{row.esicChallanNumber}</p>
            <p className="text-xs text-gray-500">
              {money(row.esicAmount)} · {dateLabel(row.esicDate)}
            </p>
          </div>
        ) : (
          <span className="text-gray-400">Not filed</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div>
          <StatusBadge status={row.status} />
          {row.status === 'verified' && row.verifiedAt && (
            // The endpoint returns the verifier's id, not their name, and there is
            // no route that resolves an arbitrary user id — so the date is what can
            // honestly be shown.
            <p className="mt-1 text-xs text-gray-500">
              Verified {dateLabel(row.verifiedAt)}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={`${lusitana.className} mb-2 text-2xl`}>
            Monthly compliance
          </h1>
          <p className="text-sm text-gray-600">
            PF and ESIC filings per contractor per month.
            {contractorId && ' Filtered to one contractor.'}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Record filing</Button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No filings recorded for this selection."
        actions={(row) =>
          row.status === 'submitted' ? (
            <button
              type="button"
              disabled={verify.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Verify this filing? Your identity is recorded against it, and the record can no longer be edited.',
                  )
                ) {
                  verify.mutate(row.id);
                }
              }}
              className="text-sm font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:text-gray-400"
            >
              Verify
            </button>
          ) : (
            // Nothing to offer: a partial filing is not verifiable and a verified one
            // is final. An always-visible disabled button would only invite clicks.
            <span className="text-xs text-gray-400">
              {row.status === 'verified' ? 'Final' : 'Needs both challans'}
            </span>
          )
        }
      />

      {modalOpen && (
        <ComplianceModal
          contractorId={contractorId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </main>
  );
}

export default function CompliancePage() {
  // `useSearchParams` needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading…</p>}>
      <CompliancePageBody />
    </Suspense>
  );
}
