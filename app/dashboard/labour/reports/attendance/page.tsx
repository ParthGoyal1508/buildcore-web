'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getAttendanceReport } from '@/app/lib/api/labour';
import { getSites } from '@/app/lib/api/projects';
import { Button } from '@/app/ui/button';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';

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
    queryFn: () => getAttendanceReport({ siteId, periodFrom, periodTo }),
    enabled: submitted && !!siteId && !!periodFrom && !!periodTo,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Attendance Report</h1>
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

      {report.data && (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          {report.data.workers.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              No approved musters for this site in the period.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Worker</th>
                  <th className="px-3 py-2">Present</th>
                  <th className="px-3 py-2">Half</th>
                  <th className="px-3 py-2">Absent</th>
                  <th className="px-3 py-2">OT hrs</th>
                  <th className="px-3 py-2">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.data.workers.map((w) => (
                  <tr key={w.workerId}>
                    <td className="px-3 py-2">{w.workerId}</td>
                    <td className="px-3 py-2">{w.daysPresent}</td>
                    <td className="px-3 py-2">{w.halfDays}</td>
                    <td className="px-3 py-2">{w.absentDays}</td>
                    <td className="px-3 py-2">{w.overtimeHours}</td>
                    <td className="px-3 py-2">{w.attendancePercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
