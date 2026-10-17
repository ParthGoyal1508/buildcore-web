'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getPaymentRegister, type PaymentRegister } from '@/app/lib/api/labour';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import { ProjectPicker } from '@/app/ui/plant/pickers';
import { labourLabel } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { TextField } from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

type RegisterLine = PaymentRegister['lines'][number] & { rowKey: string };

// Keys match the line's own fields, so each column sorts by the raw figure.
const COLUMNS: Column<RegisterLine>[] = [
  {
    key: 'workerId',
    header: 'Worker',
    // 036 O8: names, and the sheet's site and dates, from the API instead of raw ids.
    sortValue: (l) => l.workerName ?? l.labourCode ?? '',
    render: (l) => (
      <>
        {l.workerName ?? 'Unknown worker'}
        {l.labourCode && (
          <span className="ml-1 text-xs text-gray-500">{l.labourCode}</span>
        )}
        {l.kind === 'carry_forward' && (
          <span className="block text-xs text-amber-800">
            Balance carried forward
          </span>
        )}
      </>
    ),
  },
  {
    key: 'siteName',
    header: 'Sheet',
    sortValue: (l) => l.periodFrom ?? '',
    render: (l) => (
      <>
        {l.siteName ?? '—'}
        {l.periodFrom && l.periodTo && (
          <span className="block text-xs text-gray-500">
            {dateLabel(l.periodFrom)} → {dateLabel(l.periodTo)}
          </span>
        )}
      </>
    ),
  },
  {
    key: 'daysWorked',
    header: 'Days',
    numeric: true,
    render: (l) => l.daysWorked,
  },
  {
    key: 'grossWage',
    header: 'Gross',
    numeric: true,
    render: (l) => rupees(l.grossWage),
  },
  {
    key: 'netPayable',
    header: 'Net',
    numeric: true,
    render: (l) => rupees(l.netPayable),
  },
  {
    key: 'paymentMode',
    header: 'Mode',
    render: (l) => (l.paymentMode ? labourLabel(l.paymentMode) : '—'),
  },
  {
    key: 'status',
    header: 'Status',
    render: (l) => <StatusBadge status={l.status} />,
  },
];

export default function PaymentRegisterPage() {
  const [projectId, setProjectId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  // 036 O8: the report runs on what was last *Run*, not on every keystroke in the filters. The
  // query used to refetch the moment a date changed after the first Run.
  const [params, setParams] = useState<{
    projectId: string;
    periodFrom: string;
    periodTo: string;
  } | null>(null);
  const companyId = useSelectedCompanyId();

  const report = useQuery({
    queryKey: ['report-register', companyId, params],
    queryFn: () => getPaymentRegister(params!),
    enabled: !!params,
  });
  const rangeError =
    periodFrom && periodTo && periodTo < periodFrom
      ? 'The "to" date must be on or after the "from" date.'
      : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title="Payment Register" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {/* Searched on the server: one page of 200 hid the 201st project (036 follow-up). */}
        <ProjectPicker
          id="reg-project"
          label="Project"
          value={projectId}
          onChange={(id) => setProjectId(id)}
        />
        <TextField
          id="reg-from"
          label="From"
          type="date"
          value={periodFrom}
          onChange={(e) => setPeriodFrom(e.target.value)}
        />
        <TextField
          id="reg-to"
          label="To"
          type="date"
          value={periodTo}
          onChange={(e) => setPeriodTo(e.target.value)}
          error={rangeError}
        />
        <div className="flex items-end">
          <Button
            intent="read"
            className="w-full justify-center"
            onClick={() => {
              const next = { projectId, periodFrom, periodTo };
              // Running the same filters again fetches again, as a person pressing Run expects.
              if (params && JSON.stringify(params) === JSON.stringify(next)) {
                void report.refetch();
              } else {
                setParams(next);
              }
            }}
            disabled={!projectId || !periodFrom || !periodTo || !!rangeError}
            loading={report.isFetching}
          >
            Run
          </Button>
        </div>
      </div>

      {/* The shared table: sortable by any column (2026-10-15). */}
      {params && (
        <DataTable<RegisterLine>
          caption="Payment register"
          isLoading={report.isPending}
          error={report.error}
          onRetry={report.refetch}
          // A worker can appear twice on one sheet's register, so the position keeps keys unique.
          rows={(report.data?.lines ?? []).map((l, i) => ({
            ...l,
            rowKey: `${l.sheetId}-${l.workerId}-${i}`,
          }))}
          rowKey={(l) => l.rowKey}
          columns={COLUMNS}
          emptyMessage="No payment sheet lines for this project in the period."
        />
      )}
    </div>
  );
}
