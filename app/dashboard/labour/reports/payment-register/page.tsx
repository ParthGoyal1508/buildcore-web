'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getPaymentRegister } from '@/app/lib/api/labour';
import { getProjects } from '@/app/lib/api/projects';
import { labourLabel } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';

export default function PaymentRegisterPage() {
  const [projectId, setProjectId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const projects = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => getProjects({ pageSize: 200 }),
  });
  const report = useQuery({
    queryKey: ['report-register', projectId, periodFrom, periodTo],
    queryFn: () => getPaymentRegister({ projectId, periodFrom, periodTo }),
    enabled: submitted && !!projectId && !!periodFrom && !!periodTo,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Payment Register</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <SelectField
          id="reg-project"
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Select…</option>
          {projects.data?.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
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
        />
        <div className="flex items-end">
          <Button
            className="w-full justify-center"
            onClick={() => setSubmitted(true)}
            disabled={!projectId || !periodFrom || !periodTo}
          >
            Run
          </Button>
        </div>
      </div>

      {report.data && (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          {report.data.lines.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              No payment sheet lines for this project in the period.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Worker</th>
                  <th className="px-3 py-2">Days</th>
                  <th className="px-3 py-2">Gross</th>
                  <th className="px-3 py-2">Net</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.data.lines.map((l, i) => (
                  <tr key={`${l.sheetId}-${l.workerId}-${i}`}>
                    <td className="px-3 py-2">{l.workerId}</td>
                    <td className="px-3 py-2">{l.daysWorked}</td>
                    <td className="px-3 py-2">{rupees(l.grossWage)}</td>
                    <td className="px-3 py-2">{rupees(l.netPayable)}</td>
                    <td className="px-3 py-2">
                      {l.paymentMode ? labourLabel(l.paymentMode) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={l.status} />
                    </td>
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
