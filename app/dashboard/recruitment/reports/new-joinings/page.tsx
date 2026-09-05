'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getNewJoinings } from '@/app/lib/api/recruitment';
import { recruitmentLabel } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { TextField } from '@/app/ui/settings/form-fields';

export default function NewJoiningsReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const report = useQuery({
    queryKey: ['report-new-joinings', from, to],
    queryFn: () => getNewJoinings({ from, to }),
    enabled: submitted && !!from && !!to,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">New Joinings</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField id="nj-from" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField id="nj-to" label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div className="flex items-end">
          <Button className="w-full justify-center" onClick={() => setSubmitted(true)} disabled={!from || !to}>Run</Button>
        </div>
      </div>

      {report.data && (
        <div className="overflow-x-auto rounded-lg border border-gray-100">
          {report.data.items.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No joinings in this period.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Requisition</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Offered CTC</th>
                  <th className="px-3 py-2">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.data.items.map((r) => (
                  <tr key={r.candidateId}>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">{r.requisitionCode}</td>
                    <td className="px-3 py-2">{recruitmentLabel(r.source)}</td>
                    <td className="px-3 py-2">{rupees(r.offeredCtc)}</td>
                    <td className="px-3 py-2">{r.joiningDate ?? '—'}</td>
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
