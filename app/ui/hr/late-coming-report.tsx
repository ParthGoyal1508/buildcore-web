'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getLateComingReport,
  listSites,
  type lateComingRowSchema,
} from '@/app/lib/api/hr-payroll';
import { listDepartments } from '@/app/lib/api/settings';
import { MESSAGES } from '@/app/lib/constants';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';
import type { z } from 'zod';

type LateRow = z.infer<typeof lateComingRowSchema>;

/**
 * Late arrivals, early departures and short hours for a month (005 US17).
 *
 * The two "unmeasurable" columns are the point of this screen, not padding. A day
 * with no shift configured, or with no punch times, is reported by the backend
 * with an explicit marker rather than as zero minutes late — and folding those
 * into the late count would quietly flatter whoever has the least data. They are
 * shown as their own columns so a reader can see the difference between "on time"
 * and "we don't know".
 *
 * Informational only: lateness never deducts pay (FR-064), and the note below
 * says so, because a punctuality report that looks like a payroll input will
 * eventually be used as one.
 */
export default function LateComingReport() {
  const now = new Date();
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [departmentId, setDepartmentId] = useState('');
  const [siteId, setSiteId] = useState('');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => listDepartments(),
  });
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: listSites });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'lateComing', month, year, departmentId, siteId],
    queryFn: () =>
      getLateComingReport(month, year, {
        departmentId: departmentId || undefined,
        siteId: siteId || undefined,
      }),
  });

  const columns: Column<LateRow>[] = [
    { key: 'code', header: 'Code', sticky: true, render: (row) => row.employeeCode },
    { key: 'name', header: 'Employee', render: (row) => row.name },
    { key: 'lateDays', header: 'Late days', numeric: true, render: (row) => row.lateDays },
    {
      key: 'lateMinutes',
      header: 'Total late (min)',
      numeric: true,
      render: (row) => row.totalLateMinutes,
    },
    {
      key: 'early',
      header: 'Early departures',
      numeric: true,
      render: (row) => row.earlyDepartureDays,
    },
    {
      key: 'short',
      header: 'Short-hours days',
      numeric: true,
      render: (row) => row.shortHoursDays,
    },
    {
      key: 'noShift',
      header: 'No shift set',
      numeric: true,
      render: (row) =>
        row.daysWithoutShift > 0 ? (
          <span className="text-amber-700">{row.daysWithoutShift}</span>
        ) : (
          0
        ),
    },
    {
      key: 'noPunch',
      header: 'No punch times',
      numeric: true,
      render: (row) =>
        row.daysWithoutPunchTimes > 0 ? (
          <span className="text-amber-700">{row.daysWithoutPunchTimes}</span>
        ) : (
          0
        ),
    },
    {
      key: 'repeat',
      header: 'Repeat',
      render: (row) =>
        row.repeatLateComer ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
            Repeat late-comer
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          id="late-month"
          label="Month"
          value={month}
          onChange={(event) => setMonth(Number(event.target.value))}
        >
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {new Date(Date.UTC(2000, value - 1, 1)).toLocaleDateString(undefined, {
                month: 'long',
                timeZone: 'UTC',
              })}
            </option>
          ))}
        </SelectField>
        <TextField
          id="late-year"
          label="Year"
          type="number"
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        />
        <SelectField
          id="late-department"
          label="Department"
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
        >
          <option value="">All departments</option>
          {departments?.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="late-site"
          label="Site"
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
        >
          <option value="">All sites</option>
          {sites?.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </SelectField>
      </div>

      {data?.note && (
        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {data.note} Repeat late-comers are flagged at{' '}
          {data.repeatLateComerThreshold} late days in the month.
        </p>
      )}

      <DataTable
        caption="Late coming report"
        columns={columns}
        rows={data?.rows ?? []}
        rowKey={(row) => row.employeeId}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No active employees match these filters."
      />

      <p className="text-xs text-gray-600">
        “No shift set” and “No punch times” count days this report cannot measure.
        They are deliberately kept out of the late-day count — a day with no data is
        not a day on time.
      </p>
    </div>
  );
}
