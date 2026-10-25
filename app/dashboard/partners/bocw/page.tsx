'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { Suspense, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { BocwRow, exportBocw, getBocw } from '@/app/lib/api/partners';
import { BOCW_STATUSES } from '@/app/lib/constants';
import { saveBlob } from '@/app/lib/download-file';
import { rupees, todayIso } from '@/app/lib/format';
import { urlEnum, urlString, useUrlState } from '@/app/lib/use-url-state';
import { Button } from '@/app/ui/button';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import BocwPaymentModal from '@/app/ui/partners/bocw-payment-modal';
import { Field, SelectInput, TextInput } from '@/app/ui/partners/form-controls';
import PageHeader from '@/app/ui/page-header';
import { RowAction, SecondaryButton } from '@/app/ui/settings/form-fields';
import { ListSkeleton } from '@/app/ui/skeletons';
import { useToast } from '@/app/ui/toast';

const HEADERS = [
  'Project',
  'Contract value',
  'Cess rate',
  'Cess liability',
  'Paid',
  'Balance',
  'Status',
];

const STATUS_LABELS: Record<(typeof BOCW_STATUSES)[number], string> = {
  pending: 'Pending',
  partial: 'Part paid',
  paid: 'Paid',
};

function BocwPageBody() {
  const [paying, setPaying] = useState<BocwRow | null>(null);
  const toast = useToast();
  // A project search and a status filter in the URL, with a way to clear them (036 N6,
  // 2026-10-17). Since 042 the filtering is the server's: the request carries both, so the
  // rows that come back are already the matching ones.
  const [filters, setFilters, query] = useUrlState(
    {
      q: urlString(),
      status: urlEnum(['', ...BOCW_STATUSES] as const, ''),
    },
    { debounce: ['q'] },
  );
  const search = query.q.trim();
  const filtered = Boolean(search || query.status);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['partners', 'bocw', search, query.status],
    queryFn: () =>
      getBocw({
        search: search || undefined,
        status: query.status || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];

  // What goes to the welfare board or an auditor (036 N6): built by the API from the same list.
  const download = useMutation({
    mutationFn: exportBocw,
    onSuccess: (blob) => saveBlob(blob, `BOCW_Cess_${todayIso()}.xlsx`),
    onError: (err: unknown) =>
      toast.error(errorMessage(err, 'The export could not be prepared.')),
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="BOCW cess"
          description="Liability is the project’s contract value times the company cess rate, computed at request time rather than stored — so correcting a payment corrects the balance immediately."
        />
        {/* The export route takes no filters, so the label says "all" while any filter is
            on — the workbook is always every project. */}
        <Button
          intent="read"
          loading={download.isPending}
          disabled={!data || (data.rows.length === 0 && !filtered)}
          title={
            filtered
              ? 'The Excel always holds every project — the filters above do not narrow it.'
              : undefined
          }
          onClick={() => download.mutate()}
        >
          {filtered ? 'Export all to Excel' : 'Export to Excel'}
        </Button>
      </div>

      <div className="mb-4 grid items-end gap-3 sm:grid-cols-3">
        <Field id="bocw-search" label="Project">
          <TextInput
            id="bocw-search"
            type="search"
            placeholder="Search by name"
            value={filters.q}
            onChange={(event) => setFilters({ q: event.target.value })}
          />
        </Field>
        <Field id="bocw-status" label="Status">
          <SelectInput
            id="bocw-status"
            value={filters.status}
            onChange={(event) =>
              setFilters({ status: event.target.value as typeof filters.status })
            }
          >
            <option value="">All statuses</option>
            {BOCW_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div>
          {filtered && (
            <SecondaryButton
              type="button"
              onClick={() => setFilters({ q: '', status: '' })}
            >
              Clear filters
            </SecondaryButton>
          )}
        </div>
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
        rows={rows}
        rowKey={(row) => row.projectId}
        isLoading={isPending}
        error={error}
        onRetry={() => refetch()}
        emptyMessage={
          filtered
            ? 'No projects match these filters.'
            : unavailable.length > 0
              ? 'Nothing to show until the Projects module lands.'
              : 'No projects with a contract value yet.'
        }
        actions={(row) =>
          row.status === 'paid' ? (
            <span className="text-xs text-gray-500">Settled</span>
          ) : (
            <RowAction type="button" onClick={() => setPaying(row)}>
              Record payment
            </RowAction>
          )
        }
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

export default function BocwPage() {
  // `useUrlState` reads `useSearchParams`, which needs a Suspense boundary.
  return (
    <Suspense fallback={<ListSkeleton headers={HEADERS} />}>
      <BocwPageBody />
    </Suspense>
  );
}
