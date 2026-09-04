'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getResignationReport } from '@/app/lib/api/recruitment';
import { recruitmentLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { TextField } from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';

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
      <h1 className="text-xl font-semibold text-gray-900">Resignation Report</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField id="rr-from" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField id="rr-to" label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex items-end">
          <Button className="w-full justify-center" onClick={() => setSubmitted(true)} disabled={!from || !to}>Run</Button>
        </div>
      </div>

      {report.data && (
        <>
          <div className="flex flex-wrap gap-4 text-sm">
            <span>Total separations: <strong>{report.data.totalSeparations}</strong></span>
            {report.data.attritionRatePercent !== null && (
              <span>Attrition: <strong>{report.data.attritionRatePercent}%</strong></span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-600">
            {report.data.reasonCounts.map((r) => (
              <span key={r.reason} className="rounded bg-gray-50 px-2 py-1">
                {recruitmentLabel(r.reason)}: {r.count}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-100">
            {report.data.items.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">No separations in this period.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Resigned</th>
                    <th className="px-3 py-2">Last working day</th>
                    <th className="px-3 py-2">Tenure (m)</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">F&amp;F</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.data.items.map((r, i) => (
                    <tr key={`${r.employeeId}-${i}`}>
                      <td className="px-3 py-2">{r.employeeId}</td>
                      <td className="px-3 py-2">{r.resignationDate}</td>
                      <td className="px-3 py-2">{r.lastWorkingDay}</td>
                      <td className="px-3 py-2">{r.tenureMonths ?? '—'}</td>
                      <td className="px-3 py-2">{recruitmentLabel(r.reasonCategory)}</td>
                      <td className="px-3 py-2">
                        {r.settlementPending ? (
                          <StatusBadge status="overdue" label="Pending" />
                        ) : (
                          <StatusBadge status="active" label="Settled" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
