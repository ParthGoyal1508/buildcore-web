'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';

import {
  generatePayrollRun,
  isRunHasEditsError,
  listPayrollRuns,
  type PayrollRun,
} from '@/app/lib/api/hr-payroll';
import RunApprovalBadge from '@/app/ui/hr/run-approval-badge';
import { HR_MESSAGES, ROUTES } from '@/app/lib/constants';
import { currentPeriod, dateTimeLabel, periodLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import { confirmDialog } from '@/app/ui/dialogs';
import { FormError, TextField } from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';

/**
 * The payroll run list, and the one place a run is created.
 *
 * Generating a new period is not destructive — it produces a draft — so it is a plain button. Over
 * an **existing draft** it asks first (036 F10): regenerating silently replaced the draft somebody
 * may have been checking. A draft moves no balances (036 F1/F2), so the replacement costs only the
 * lines. The irreversible steps (process, mark paid) live on the run's own page.
 */
export default function PayrollRunsTable() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  const runs = useQuery({
    queryKey: ['hr', 'payrollRuns'],
    queryFn: listPayrollRuns,
  });
  const { data } = runs;

  const generate = useMutation({
    mutationFn: (discardEdits: boolean) => generatePayrollRun(period, discardEdits),
    onSuccess: (result) => {
      setError(null);
      const flagged = result.exceptions?.length ?? 0;
      toast.success(
        `Draft for ${periodLabel(result.period)} generated${
          result.lineCount !== undefined ? ` with ${result.lineCount} employees` : ''
        }.${flagged ? ` ${flagged} need attention — see the run.` : ''}`,
      );
      queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRun', result.runId] });
    },
    onError: async (err: Error) => {
      // 039: the draft has hand corrections, each justified. Regenerating discards them, so ask.
      if (isRunHasEditsError(err)) {
        const discard = await confirmDialog({
          title: 'Discard the corrections?',
          message: `${errorMessage(err)} Their change history goes with them.`,
          confirmLabel: 'Discard and regenerate',
          tone: 'danger',
        });
        if (discard) generate.mutate(true);
        return;
      }
      setError(errorMessage(err, 'Could not generate the run.'));
    },
  });

  const submit = async () => {
    const existing = (data ?? []).find(
      (run) => run.period === period && !run.isFnf,
    );
    if (existing?.status === 'draft') {
      const ok = await confirmDialog({
        title: 'Replace the existing draft?',
        message: `This replaces the existing draft for ${periodLabel(
          period,
        )} with freshly computed figures. Nothing has been paid or recovered from the draft, so nothing else changes.`,
        confirmLabel: 'Regenerate draft',
        tone: 'default',
      });
      if (!ok) return;
    }
    generate.mutate(false);
  };

  const columns: Column<PayrollRun>[] = [
    {
      key: 'period',
      header: 'Period',
      sticky: true,
      render: (row) => (
        <Link
          href={ROUTES.hrPayrollRun(row.id)}
          className="font-medium text-brand-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
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
      key: 'approval',
      header: 'Director approval',
      render: (row) => <RunApprovalBadge run={row} />,
      sortValue: (row) => row.approval?.state ?? '',
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
          void submit();
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
        <Button type="submit" disabled={!period} loading={generate.isPending}>
          Generate run
        </Button>
        <p className="w-full text-xs text-gray-600">
          A generated run starts as a draft. Review and correct it, send it to the Director, and
          process it once approved. Regenerating a draft replaces its figures; nothing is
          recovered, settled or paid until the run is processed.
        </p>
      </form>

      <FormError message={error} />

      <DataTable
        caption="Payroll runs"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={runs.isPending}
        error={runs.isError ? runs.error : null}
        onRetry={() => runs.refetch()}
        emptyMessage="No payroll runs yet."
      />

      <p className="text-xs text-gray-600">{HR_MESSAGES.runLocked}</p>
    </div>
  );
}
