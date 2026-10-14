'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getNewJoinings } from '@/app/lib/api/recruitment';
import { recruitmentLabel } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { TextField } from '@/app/ui/settings/form-fields';
import PageHeader from '@/app/ui/page-header';

type Joining = Awaited<ReturnType<typeof getNewJoinings>>['items'][number];

// Keys match the row's own fields, so each column sorts by the raw value — the date as a date.
const COLUMNS: Column<Joining>[] = [
  { key: 'name', header: 'Name', render: (r) => r.name },
  {
    key: 'requisitionCode',
    header: 'Requisition',
    render: (r) => r.requisitionCode,
  },
  {
    key: 'source',
    header: 'Source',
    render: (r) => recruitmentLabel(r.source),
  },
  {
    key: 'offeredCtc',
    header: 'Offered CTC',
    numeric: true,
    render: (r) => rupees(r.offeredCtc),
  },
  { key: 'joiningDate', header: 'Joined', render: (r) => r.joiningDate ?? '—' },
];

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
      <PageHeader title="New Joinings" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField
          id="nj-from"
          label="From"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField
          id="nj-to"
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

      {/* The shared table: sortable by any column (2026-10-15). */}
      {report.data && (
        <DataTable<Joining>
          caption="New joinings"
          rows={report.data.items}
          rowKey={(r) => r.candidateId}
          columns={COLUMNS}
          emptyMessage="No joinings in this period."
        />
      )}
    </div>
  );
}
