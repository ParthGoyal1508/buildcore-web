'use client';

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Suspense, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  MonthlyCompliance,
  getCompliance,
  getContractors,
  verifyCompliance,
} from '@/app/lib/api/partners';
import {
  MESSAGES,
  MONTHLY_COMPLIANCE_STATUSES,
  partnersLabel,
} from '@/app/lib/constants';
import { dateLabel, money, periodLabel } from '@/app/lib/format';
import { urlEnum, urlString, useUrlState } from '@/app/lib/use-url-state';
import { Button } from '@/app/ui/button';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import ComplianceModal from '@/app/ui/partners/compliance-modal';
import { Field, SelectInput, TextInput } from '@/app/ui/partners/form-controls';
import PageHeader from '@/app/ui/page-header';
import { confirmDialog } from '@/app/ui/dialogs';
import { RowAction, SecondaryButton } from '@/app/ui/settings/form-fields';
import { ListSkeleton } from '@/app/ui/skeletons';
import { useToast } from '@/app/ui/toast';

const HEADERS = ['Contractor', 'Month', 'PF challan', 'ESIC challan', 'Status'];

function CompliancePageBody() {
  // On-page filters, in the URL (036 N6, 2026-10-17). The contractor and month arrived only
  // as URL parameters — from a RAG cell or a contractor's page — with no control showing them
  // and no way to clear them short of editing the address. The parameter names are kept so
  // those links still land here filtered.
  const [filters, setFilters, query] = useUrlState({
    contractorId: urlString(),
    month: urlString(),
    status: urlEnum(['', ...MONTHLY_COMPLIANCE_STATUSES] as const, ''),
  });
  const contractorId = query.contractorId || undefined;
  const month = /^\d{4}-\d{2}$/.test(query.month) ? query.month : undefined;
  const filtered = Boolean(contractorId || month || query.status);

  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const params = {
    contractorProfileId: contractorId,
    month,
    status: query.status || undefined,
  };

  const { data, isPending, error, refetch, isPlaceholderData, isFetching } =
    useQuery({
      queryKey: ['partners', 'compliance', params],
      queryFn: () => getCompliance(params),
      placeholderData: keepPreviousData,
    });

  // The same cache entry the filing modal reads.
  const { data: contractors } = useQuery({
    queryKey: ['partners', 'contractors', ''],
    queryFn: () => getContractors(),
  });
  const contractorName = contractors?.find((c) => c.id === contractorId)?.vendorName;

  const verify = useMutation({
    mutationFn: (id: string) => verifyCompliance(id),
    onSuccess: () => {
      toast.success('Filing verified.');
      queryClient.invalidateQueries({ queryKey: ['partners', 'compliance'] });
      queryClient.invalidateQueries({ queryKey: ['partners', 'rag'] });
      // The contractor's own status is recomputed server-side by the same
      // transaction, so its badge elsewhere is stale until this is invalidated.
      queryClient.invalidateQueries({ queryKey: ['partners', 'contractors'] });
      queryClient.invalidateQueries({ queryKey: ['partners', 'contractor'] });
    },
    onError: (err: unknown) => toast.error(errorMessage(err, MESSAGES.saveFailed)),
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
          <PageHeader
            title="Monthly compliance"
            description={
              <>
                PF and ESIC filings per contractor per month.
              </>
            }
          />
        </div>
        <Button onClick={() => setModalOpen(true)}>
          {month ? `Record filing for ${periodLabel(month)}` : 'Record filing'}
        </Button>
      </div>

      <div className="mb-4 grid items-end gap-3 sm:grid-cols-4">
        <Field id="compliance-filter-contractor" label="Contractor">
          <SelectInput
            id="compliance-filter-contractor"
            value={filters.contractorId}
            onChange={(event) => setFilters({ contractorId: event.target.value })}
          >
            <option value="">All contractors</option>
            {/* A contractor in the URL that the list does not hold (deactivated vendor) still
                shows as selected rather than silently reading "All". */}
            {contractorId && contractors && !contractorName && (
              <option value={contractorId}>Selected contractor</option>
            )}
            {(contractors ?? []).map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.vendorName} ({contractor.vendorCode})
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field id="compliance-filter-month" label="Month">
          <TextInput
            id="compliance-filter-month"
            type="month"
            value={filters.month}
            onChange={(event) => setFilters({ month: event.target.value })}
          />
        </Field>
        <Field id="compliance-filter-status" label="Status">
          <SelectInput
            id="compliance-filter-status"
            value={filters.status}
            onChange={(event) =>
              setFilters({ status: event.target.value as typeof filters.status })
            }
          >
            <option value="">All statuses</option>
            {MONTHLY_COMPLIANCE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {partnersLabel(value)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div>
          {filtered && (
            <SecondaryButton
              type="button"
              onClick={() => setFilters({ contractorId: '', month: '', status: '' })}
            >
              Clear filters
            </SecondaryButton>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isPending}
        error={error}
        onRetry={() => refetch()}
        isRefreshing={isPlaceholderData && isFetching}
        emptyMessage={
          filtered
            ? `No filings recorded${contractorName ? ` for ${contractorName}` : ''}${month ? ` in ${periodLabel(month)}` : ''}${query.status ? ` with status ${partnersLabel(query.status).toLowerCase()}` : ''}.`
            : 'No filings recorded yet.'
        }
        actions={(row) =>
          row.status === 'submitted' ? (
            <RowAction
              type="button"
              loading={verify.isPending && verify.variables === row.id}
              disabled={verify.isPending}
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Verify this filing?',
                    message:
                      'Verify this filing? Your identity is recorded against it, and the record can no longer be edited.',
                    confirmLabel: 'Verify',
                    tone: 'default',
                  })
                ) {
                  verify.mutate(row.id);
                }
              }}
            >
              Verify
            </RowAction>
          ) : (
            // Nothing to offer: a partial filing is not verifiable and a verified one
            // is final. An always-visible disabled button would only invite clicks.
            <span className="text-xs text-gray-500">
              {row.status === 'verified' ? 'Final' : 'Needs both challans'}
            </span>
          )
        }
      />

      {modalOpen && (
        <ComplianceModal
          contractorId={contractorId}
          month={month}
          onClose={() => setModalOpen(false)}
        />
      )}
    </main>
  );
}

export default function CompliancePage() {
  // `useSearchParams` needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<ListSkeleton headers={HEADERS} />}>
      <CompliancePageBody />
    </Suspense>
  );
}
