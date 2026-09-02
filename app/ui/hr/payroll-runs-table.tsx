'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import {
  generatePayrollRun,
  listPayrollRuns,
  type PayrollRun,
} from '@/app/lib/api/hr-payroll';
import { HR_MESSAGES, MESSAGES, ROUTES } from '@/app/lib/constants';
import { currentPeriod, dateTimeLabel, periodLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import { FormError, TextField } from '@/app/ui/settings/form-fields';

/**
 * The payroll run list, and the one place a run is created.
 *
 * Generating a run is not destructive — it produces a draft — so it is a plain
 * button rather than a confirmed action. The irreversible steps (process, mark
 * paid) live on the run's own page, where the figures being frozen are visible.
 */
export default function PayrollRunsTable() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'payrollRuns'],
    queryFn: listPayrollRuns,
  });

  const generate = useMutation({
    mutationFn: () => generatePayrollRun(period),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRuns'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const columns: Column<PayrollRun>[] = [
    {
      key: 'period',
      header: 'Period',
      sticky: true,
      render: (row) => (
        <Link
          href={ROUTES.hrPayrollRun(row.id)}
          className="font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          {periodLabel(row.period)}
        </Link>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (row.isFnf ? 'Full & Final' : 'Monthly'),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'generated',
      header: 'Generated',
      render: (row) => dateTimeLabel(row.generatedAt),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          generate.mutate();
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 p-4"
      >
        <div className="max-w-xs flex-1">
          <TextField
            id="run-period"
            label="Period"
            type="month"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={!period || generate.isPending}>
          {generate.isPending ? 'Generating…' : 'Generate run'}
        </Button>
        <p className="w-full text-xs text-gray-600">
          A generated run starts as a draft. Its figures are only frozen when it is
          processed.
        </p>
      </form>

      <FormError message={error} />

      <DataTable
        caption="Payroll runs"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No payroll runs yet."
      />

      <p className="text-xs text-gray-600">{HR_MESSAGES.runLocked}</p>
    </div>
  );
}
