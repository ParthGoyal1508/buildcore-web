'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getAttendanceReport,
  type AttendanceReport,
} from '@/app/lib/api/labour';
import { getSites } from '@/app/lib/api/projects';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';
import PageHeader from '@/app/ui/page-header';

type AttendanceRow = AttendanceReport['workers'][number];

// Keys match the row's own fields, so each column sorts by the raw figure.
const COLUMNS: Column<AttendanceRow>[] = [
  { key: 'workerId', header: 'Worker', render: (w) => w.workerId },
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
  const [submitted, setSubmitted] = useState(false);

  const sites = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => getSites({ pageSize: 200 }),
  });
  const report = useQuery({
    queryKey: ['report-attendance', siteId, periodFrom, periodTo],
    queryFn: () =>
      getAttendanceReport({
        siteId,
        periodFrom,
        periodTo,
      }),
    enabled: submitted && !!siteId && !!periodFrom && !!periodTo,
  });

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
          {sites.data?.items.map((s) => (
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
        />
        <div className="flex items-end">
          <Button
            className="w-full justify-center"
            onClick={() => setSubmitted(true)}
            disabled={!siteId || !periodFrom || !periodTo}
          >
            Run
          </Button>
        </div>
      </div>

      {/* The shared table: sortable by any column (2026-10-15). */}
      {report.data && (
        <DataTable<AttendanceRow>
          caption="Attendance by worker"
          rows={report.data.workers}
          rowKey={(w) => w.workerId}
          columns={COLUMNS}
          emptyMessage="No approved musters for this site in the period."
        />
      )}
    </div>
  );
}
