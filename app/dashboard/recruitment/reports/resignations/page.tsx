'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getResignationReport } from '@/app/lib/api/recruitment';
import { recruitmentLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { TextField } from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

type Separation = Awaited<
  ReturnType<typeof getResignationReport>
>['items'][number] & { rowKey: string };

// Keys match the row's own fields, so each column sorts by the raw value — dates as dates.
const COLUMNS: Column<Separation>[] = [
  { key: 'employeeId', header: 'Employee', render: (r) => r.employeeId },
  {
    key: 'resignationDate',
    header: 'Resigned',
    render: (r) => r.resignationDate,
  },
  {
    key: 'lastWorkingDay',
    header: 'Last working day',
    render: (r) => r.lastWorkingDay,
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
  const [submitted, setSubmitted] = useState(false);

  const report = useQuery({
    queryKey: ['report-resignations', from, to],
    queryFn: () => getResignationReport({ from, to }),
    enabled: submitted && !!from && !!to,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Resignation Report" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField
          id="rr-from"
          label="From"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField
          id="rr-to"
          label="To"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <div className="flex items-end">
          <Button
            intent="read"
            className="w-full justify-center"
            onClick={() => setSubmitted(true)}
            disabled={!from || !to}
          >
            Run
          </Button>
        </div>
      </div>

      {report.data && (
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

          {/* The shared table: sortable by any column (2026-10-15). */}
          <DataTable<Separation>
            caption="Separations"
            // An employee can resign twice in a long period, so the position keeps keys unique.
            rows={report.data.items.map((r, i) => ({
              ...r,
              rowKey: `${r.employeeId}-${i}`,
            }))}
            rowKey={(r) => r.rowKey}
            columns={COLUMNS}
            emptyMessage="No separations in this period."
          />
        </>
      )}
    </div>
  );
}
