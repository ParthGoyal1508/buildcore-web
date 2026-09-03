'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { BocwRow, getBocw } from '@/app/lib/api/partners';
import { MESSAGES } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { lusitana } from '@/app/ui/fonts';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import BocwPaymentModal from '@/app/ui/partners/bocw-payment-modal';

export default function BocwPage() {
  const [paying, setPaying] = useState<BocwRow | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['partners', 'bocw'],
    queryFn: getBocw,
  });

  const columns: Column<BocwRow>[] = [
    {
      key: 'project',
      header: 'Project',
      sticky: true,
      render: (row) => (
        <span className="font-medium text-gray-900">{row.projectName}</span>
      ),
    },
    {
      key: 'contractValue',
      header: 'Contract value',
      numeric: true,
      render: (row) => rupees(row.contractValue),
    },
    {
      key: 'rate',
      header: 'Cess rate',
      numeric: true,
      render: (row) => `${(row.cessRate * 100).toFixed(2)}%`,
    },
    {
      key: 'liability',
      header: 'Cess liability',
      numeric: true,
      render: (row) => rupees(row.cessLiability),
    },
    {
      key: 'paid',
      header: 'Paid',
      numeric: true,
      render: (row) => rupees(row.totalPaid),
    },
    {
      key: 'balance',
      header: 'Balance',
      numeric: true,
      render: (row) => rupees(row.balance),
    },
    {
      key: 'status',
      header: 'Status',
      // Prefixed key: BOCW's `partial` means part-paid and reads as orange, while
      // compliance's `partial` means one of two challans and is amber. Same word,
      // different meaning, so a different badge key.
      render: (row) => <StatusBadge status={`bocw_${row.status}`} />,
    },
  ];

  const unavailable = data?.unavailableModules ?? [];

  return (
    <main>
      <div className="mb-6">
        <h1 className={`${lusitana.className} mb-2 text-2xl`}>BOCW cess</h1>
        <p className="text-sm text-gray-600">
          Liability is the project’s contract value times the company cess rate,
          computed at request time rather than stored — so correcting a payment
          corrects the balance immediately.
        </p>
      </div>

      {unavailable.length > 0 && (
        // The distinction the backend is careful to make: no projects listed does
        // not mean the company has none.
        <p className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          Project data is not available yet, so no cess liability can be shown. The
          Projects module ({unavailable.join(', ')}) has not been built — payments
          recorded against a project will appear here once it is.
        </p>
      )}

      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        rowKey={(row) => row.projectId}
        isLoading={isPending}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage={
          unavailable.length > 0
            ? 'Nothing to show until the Projects module lands.'
            : 'No projects with a contract value yet.'
        }
        actions={(row) => (
          <button
            type="button"
            disabled={row.status === 'paid'}
            onClick={() => setPaying(row)}
            className="text-sm font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:text-gray-400 disabled:no-underline"
          >
            {row.status === 'paid' ? 'Settled' : 'Record payment'}
          </button>
        )}
      />

      {paying && (
        <BocwPaymentModal
          projectId={paying.projectId}
          projectName={paying.projectName}
          balance={paying.balance}
          onClose={() => setPaying(null)}
        />
      )}
    </main>
  );
}
