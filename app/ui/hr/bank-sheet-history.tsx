'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  downloadBankSheetHistoryFile,
  getBankSheetHistory,
  type BankSheetExport,
} from '@/app/lib/api/hr-payroll';
import { saveBlob } from '@/app/lib/download-file';
import { periodLabel, dateTimeLabel } from '@/app/lib/format';
import { formatRupees } from '@/app/lib/utils';
import { FormError, RowAction } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';

/**
 * Every bank sheet generated for the company, newest first (2026-10-17) — from this card and from a
 * run's own Bank sheet button — with who generated it, the debit account, the count and the total,
 * and the exact file given to the bank to download again.
 */
export default function BankSheetHistory({ companyId }: { companyId: string }) {
  const [error, setError] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ['hr', 'bank-sheet-history', companyId],
    queryFn: () => getBankSheetHistory(companyId ? { companyId } : {}),
  });
  const download = useMutation({
    mutationFn: (entry: BankSheetExport) => downloadBankSheetHistoryFile(entry),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (e) =>
      setError(
        e instanceof ApiError && e.status < 500 ? e.message : 'Could not download that sheet.',
      ),
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
      <h3 className="mb-2 text-sm font-semibold text-gray-900">Generated bank sheets</h3>
      <FormError message={error} />
      <ResponsiveList
        columns={columns}
        rows={history.data ?? []}
        rowKey={(r) => r.id}
        isLoading={history.isPending}
        error={history.isError ? 'Could not load the generated sheets.' : undefined}
        emptyMessage="No bank sheet has been generated for this company yet."
        actions={(r) => (
          <RowAction
            intent="read"
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
    </div>
  );
}
