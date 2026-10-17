'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getNewJoinings } from '@/app/lib/api/recruitment';
import { recruitmentLabel } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { downloadCsv } from '@/app/ui/recruitment/csv';
import { SecondaryButton, TextField } from '@/app/ui/settings/form-fields';
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
  {
    key: 'joiningDate',
    header: 'Joined',
    render: (r) => (r.joiningDate ? dateLabel(r.joiningDate) : '—'),
  },
];

export default function NewJoiningsReportPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // 036 H5: the range the report was run for, frozen until Run is pressed again. The query used to
  // key on the live fields, so after the first Run every keystroke in a date refetched — with no
  // sign it was loading, and a reversed range was sent as readily as any other.
  const [submitted, setSubmitted] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const reversed = Boolean(from && to && from > to);

  const report = useQuery({
    queryKey: ['report-new-joinings', submitted?.from, submitted?.to],
    queryFn: () => getNewJoinings(submitted!),
    enabled: submitted !== null,
  });
  const run = () => {
    if (!from || !to || reversed) return;
    if (submitted?.from === from && submitted.to === to) void report.refetch();
    else setSubmitted({ from, to });
  };
  const exportCsv = () => {
    if (!report.data || !submitted) return;
    downloadCsv(`new-joinings-${submitted.from}-${submitted.to}.csv`, [
      ['Name', 'Requisition', 'Source', 'Offered CTC', 'Joined'],
      ...report.data.items.map((r) => [
        r.name,
        r.requisitionCode,
        recruitmentLabel(r.source),
        r.offeredCtc,
        r.joiningDate ? dateLabel(r.joiningDate) : '',
      ]),
    ]);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="New Joinings" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField
          id="nj-from"
          label="From"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField
          id="nj-to"
          label="To"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          min={from || undefined}
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
          Joinings from {dateLabel(submitted.from)} to {dateLabel(submitted.to)}
          {(submitted.from !== from || submitted.to !== to) &&
            ' — press Run for the new dates.'}
        </p>
      )}

      {/* The shared table: sortable by any column (2026-10-15). */}
      {submitted && (
        <DataTable<Joining>
          caption="New joinings"
          rows={report.data?.items ?? []}
          rowKey={(r) => r.candidateId}
          columns={COLUMNS}
          isLoading={report.isPending}
          error={report.isError ? report.error : undefined}
          onRetry={report.refetch}
          emptyMessage="No joinings in this period."
        />
      )}
    </div>
  );
}
