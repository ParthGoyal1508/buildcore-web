'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  downloadBankSheetHistoryFile,
  getBankSheetHistory,
  type BankSheetExport,
} from '@/app/lib/api/hr-payroll';
import { saveBlob } from '@/app/lib/download-file';
import { periodLabel, dateTimeLabel } from '@/app/lib/format';
import { formatRupees } from '@/app/lib/utils';
import {
  CheckboxField,
  FormError,
  RowAction,
  SecondaryButton,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';

const PAGE_SIZE = 20;

/**
 * Every bank sheet generated for the company, newest first (2026-10-17) — from this card and from a
 * run's own Bank sheet button — with who generated it, the debit account, the count and the total,
 * and the exact file given to the bank to download again.
 *
 * 036 F11: filtered to the month chosen above by default (it showed every month, capped at 100,
 * whatever month was selected), with "All months" to widen it, and paged. The server's total rides
 * in a header the shared client cannot read, so Next is offered while a page comes back full.
 * The parent remounts this (`key`) when the month or company changes, which resets the page.
 */
export default function BankSheetHistory({
  companyId,
  month,
}: {
  companyId: string;
  /** `YYYY-MM`, the month selected on the card. */
  month: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [allMonths, setAllMonths] = useState(false);
  const [page, setPage] = useState(1);
  const [year, monthNumber] = month.split('-').map(Number);
  const history = useQuery({
    queryKey: ['hr', 'bank-sheet-history', companyId, allMonths ? 'all' : month, page],
    queryFn: () =>
      getBankSheetHistory({
        ...(companyId ? { companyId } : {}),
        ...(allMonths || !year || !monthNumber ? {} : { year, month: monthNumber }),
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const rows = history.data ?? [];
  const download = useMutation({
    mutationFn: (entry: BankSheetExport) => downloadBankSheetHistoryFile(entry),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (e) => setError(errorMessage(e, 'Could not download that sheet.')),
  });

  const columns: Column<BankSheetExport>[] = [
    { key: 'period', header: 'Month', render: (r) => periodLabel(r.period) },
    {
      key: 'generatedAt',
      header: 'Generated',
      render: (r) => (
        <span className="whitespace-nowrap">
          {dateTimeLabel(r.generatedAt)}
          {r.generatedBy && (
            <span className="block text-xs text-gray-500">{r.generatedBy}</span>
          )}
        </span>
      ),
    },
    { key: 'employees', header: 'Employees', render: (r) => String(r.employeeCount) },
    {
      key: 'total',
      header: 'Total',
      render: (r) => <span className="whitespace-nowrap">{formatRupees(r.transferTotal)}</span>,
    },
    {
      key: 'leftOff',
      header: 'Left off',
      hideOnCard: true,
      render: (r) => (r.leftOffCount ? String(r.leftOffCount) : '—'),
    },
    {
      key: 'debit',
      header: 'Debit account',
      hideOnCard: true,
      render: (r) => <span className="font-mono text-xs">{r.debitAccount}</span>,
    },
  ];

  return (
    <div className="mt-6 border-t border-gray-100 pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          Generated bank sheets
          {!allMonths && month ? ` · ${periodLabel(month)}` : ''}
        </h3>
        <CheckboxField
          id="bank-sheet-history-all"
          label="All months"
          checked={allMonths}
          onChange={(event) => {
            setAllMonths(event.target.checked);
            setPage(1);
          }}
        />
      </div>
      <FormError message={error} />
      <ResponsiveList
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        isLoading={history.isPending}
        error={history.isError ? history.error : undefined}
        onRetry={() => history.refetch()}
        serverPaged
        isRefreshing={history.isPlaceholderData}
        emptyMessage={
          allMonths
            ? 'No bank sheet has been generated for this company yet.'
            : 'No bank sheet has been generated for this month yet.'
        }
        actions={(r) => (
          <RowAction
            intent="read"
            loading={download.isPending && download.variables?.id === r.id}
            disabled={download.isPending}
            onClick={() => {
              setError(null);
              download.mutate(r);
            }}
          >
            Download
          </RowAction>
        )}
      />
      {(page > 1 || rows.length === PAGE_SIZE) && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm text-gray-600">
          <SecondaryButton
            type="button"
            disabled={page === 1 || history.isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </SecondaryButton>
          <span>Page {page}</span>
          <SecondaryButton
            type="button"
            disabled={rows.length < PAGE_SIZE || history.isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </SecondaryButton>
        </div>
      )}
    </div>
  );
}
