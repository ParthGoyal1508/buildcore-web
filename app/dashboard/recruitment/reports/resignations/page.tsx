'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getResignationReport } from '@/app/lib/api/recruitment';
import { recruitmentLabel } from '@/app/lib/constants';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { downloadCsv } from '@/app/ui/recruitment/csv';
import { SecondaryButton, TextField } from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

type Separation = Awaited<
  ReturnType<typeof getResignationReport>
>['items'][number] & { rowKey: string };

/** The name, else the code — never a raw id unless the server could name nobody. */
function employeeLabel(r: Separation): string {
  return r.employeeName || r.employeeCode || 'Unknown employee';
}

// Keys match the row's own fields, so each column sorts by the raw value — dates as dates.
const COLUMNS: Column<Separation>[] = [
  {
    key: 'employeeName',
    header: 'Employee',
    sortValue: (r) => employeeLabel(r),
    render: (r) => (
      <span>
        {employeeLabel(r)}
        {r.employeeName && r.employeeCode && (
          <span className="block text-xs text-gray-500">{r.employeeCode}</span>
        )}
      </span>
    ),
  },
  {
    key: 'resignationDate',
    header: 'Resigned',
    render: (r) => dateLabel(r.resignationDate),
  },
  {
    key: 'lastWorkingDay',
    header: 'Last working day',
    render: (r) => dateLabel(r.lastWorkingDay),
  },
  {
    key: 'tenureMonths',
    header: 'Tenure (m)',
    numeric: true,
    render: (r) => r.tenureMonths ?? '—',
  },
  {
    key: 'reasonCategory',
    header: 'Reason',
    render: (r) => recruitmentLabel(r.reasonCategory),
  },
  {
    key: 'settlementPending',
    header: 'F&F',
    render: (r) =>
      r.settlementPending ? (
        <StatusBadge status="overdue" label="Pending" />
      ) : (
        <StatusBadge status="active" label="Settled" />
      ),
  },
];

export default function ResignationReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // The range the report was run for, frozen until Run is pressed again — the fix H5 made for new
  // joinings (036 follow-up). The query keyed on the live fields, so after the first Run every change
  // to a date refetched, with no sign it was loading.
  const [submitted, setSubmitted] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const reversed = Boolean(from && to && from > to);

  const report = useQuery({
    queryKey: ['report-resignations', submitted?.from, submitted?.to],
    queryFn: () => getResignationReport(submitted!),
    enabled: submitted !== null,
  });
  const run = () => {
    if (!from || !to || reversed) return;
    if (submitted?.from === from && submitted.to === to) void report.refetch();
    else setSubmitted({ from, to });
  };
  const exportCsv = () => {
    if (!report.data || !submitted) return;
    downloadCsv(`resignations-${submitted.from}-${submitted.to}.csv`, [
      [
        'Employee',
        'Code',
        'Resigned',
        'Last working day',
        'Tenure (months)',
        'Reason',
        'F&F',
      ],
      ...report.data.items.map((r) => [
        r.employeeName ?? '',
        r.employeeCode ?? '',
        dateLabel(r.resignationDate),
        dateLabel(r.lastWorkingDay),
        r.tenureMonths ?? '',
        recruitmentLabel(r.reasonCategory),
        r.settlementPending ? 'Pending' : 'Settled',
      ]),
    ]);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Resignation Report" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField
          id="rr-from"
          label="From"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField
          id="rr-to"
          label="To"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => setTo(e.target.value)}
          error={reversed ? 'Must be on or after the from date.' : undefined}
        />
        <div className="flex items-end gap-2">
          <Button
            intent="read"
            className="flex-1 justify-center"
            onClick={run}
            disabled={!from || !to || reversed}
            loading={report.isFetching}
          >
            Run
          </Button>
          <SecondaryButton
            onClick={exportCsv}
            disabled={!report.data || report.data.items.length === 0}
          >
            Export CSV
          </SecondaryButton>
        </div>
      </div>

      {submitted && (
        <p className="text-sm text-gray-600">
          Separations from {dateLabel(submitted.from)} to{' '}
          {dateLabel(submitted.to)}
          {(submitted.from !== from || submitted.to !== to) &&
            ' — press Run for the new dates.'}
        </p>
      )}

      {report.data && report.data.items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              Total separations: <strong>{report.data.totalSeparations}</strong>
            </span>
            {report.data.attritionRatePercent !== null && (
              <span>
                Attrition: <strong>{report.data.attritionRatePercent}%</strong>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
            {report.data.reasonCounts.map((r) => (
              <span key={r.reason} className="rounded bg-gray-50 px-2 py-1">
                {recruitmentLabel(r.reason)}: {r.count}
              </span>
            ))}
          </div>
        </>
      )}

      {/* The shared table: sortable by any column (2026-10-15). */}
      {submitted && (
        <DataTable<Separation>
          caption="Separations"
          // An employee can resign twice in a long period, so the position keeps keys unique.
          rows={(report.data?.items ?? []).map((r, i) => ({
            ...r,
            rowKey: `${r.employeeId}-${i}`,
          }))}
          rowKey={(r) => r.rowKey}
          columns={COLUMNS}
          isLoading={report.isPending}
          error={report.isError ? report.error : undefined}
          onRetry={report.refetch}
          emptyMessage="No separations in this period."
        />
      )}
    </div>
  );
}
