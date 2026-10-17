'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  getAttendanceReport,
  getMyLabourSites,
  type AttendanceReport,
} from '@/app/lib/api/labour';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';
import PageHeader from '@/app/ui/page-header';

type AttendanceRow = AttendanceReport['workers'][number];

// Keys match the row's own fields, so each column sorts by the raw figure.
const COLUMNS: Column<AttendanceRow>[] = [
  {
    key: 'workerId',
    header: 'Worker',
    // 036 O8: names from the API instead of the raw worker id.
    sortValue: (w) => w.workerName ?? w.labourCode ?? '',
    render: (w) => (
      <>
        {w.workerName ?? 'Unknown worker'}
        {w.labourCode && (
          <span className="ml-1 text-xs text-gray-500">{w.labourCode}</span>
        )}
      </>
    ),
  },
  {
    key: 'daysPresent',
    header: 'Present',
    numeric: true,
    render: (w) => w.daysPresent,
  },
  { key: 'halfDays', header: 'Half', numeric: true, render: (w) => w.halfDays },
  {
    key: 'absentDays',
    header: 'Absent',
    numeric: true,
    render: (w) => w.absentDays,
  },
  {
    key: 'overtimeHours',
    header: 'OT hrs',
    numeric: true,
    render: (w) => w.overtimeHours,
  },
  {
    key: 'attendancePercent',
    header: 'Attendance %',
    numeric: true,
    render: (w) => `${w.attendancePercent}%`,
  },
];

export default function AttendanceReportPage() {
  const [siteId, setSiteId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  // 036 O8: the report runs on what was last *Run*, not on every keystroke in the filters. The
  // query used to refetch the moment a date changed after the first Run.
  const [params, setParams] = useState<{
    siteId: string;
    periodFrom: string;
    periodTo: string;
  } | null>(null);
  const companyId = useSelectedCompanyId();

  const sites = useQuery({
    queryKey: ['labour', 'my-sites', companyId],
    queryFn: getMyLabourSites,
  });
  const report = useQuery({
    queryKey: ['report-attendance', companyId, params],
    queryFn: () => getAttendanceReport(params!),
    enabled: !!params,
  });
  const rangeError =
    periodFrom && periodTo && periodTo < periodFrom
      ? 'The "to" date must be on or after the "from" date.'
      : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title="Attendance Report" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <SelectField
          id="att-site"
          label="Site"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">Select…</option>
          {sites.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="att-from"
          label="From"
          type="date"
          value={periodFrom}
          onChange={(e) => setPeriodFrom(e.target.value)}
        />
        <TextField
          id="att-to"
          label="To"
          type="date"
          value={periodTo}
          onChange={(e) => setPeriodTo(e.target.value)}
          error={rangeError}
        />
        <div className="flex items-end">
          <Button intent="read"
            className="w-full justify-center"
            onClick={() => {
              const next = { siteId, periodFrom, periodTo };
              // Running the same filters again fetches again, as a person pressing Run expects.
              if (params && JSON.stringify(params) === JSON.stringify(next)) {
                void report.refetch();
              } else {
                setParams(next);
              }
            }}
            disabled={!siteId || !periodFrom || !periodTo || !!rangeError}
            loading={report.isFetching}
          >
            Run
          </Button>
        </div>
      </div>

      {/* The shared table: sortable by any column (2026-10-15). */}
      {params && report.data && (
        <p className="text-sm text-gray-600">
          {report.data.siteName ?? 'Site'} · {dateLabel(params.periodFrom)} to{' '}
          {dateLabel(params.periodTo)} · {report.data.totalMusterDays} muster day
          {report.data.totalMusterDays === 1 ? '' : 's'}
        </p>
      )}
      {params && (
        <DataTable<AttendanceRow>
          caption="Attendance by worker"
          rows={report.data?.workers ?? []}
          rowKey={(w) => w.workerId}
          columns={COLUMNS}
          isLoading={report.isPending}
          error={report.error}
          onRetry={report.refetch}
          emptyMessage="No approved musters for this site in the period."
        />
      )}
    </div>
  );
}
