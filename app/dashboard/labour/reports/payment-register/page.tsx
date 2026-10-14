'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getPaymentRegister, type PaymentRegister } from '@/app/lib/api/labour';
import { getProjects } from '@/app/lib/api/projects';
import { labourLabel } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { SelectField, TextField } from '@/app/ui/settings/form-fields';
import StatusBadge from '@/app/ui/status-badge';
import PageHeader from '@/app/ui/page-header';

type RegisterLine = PaymentRegister['lines'][number] & { rowKey: string };

// Keys match the line's own fields, so each column sorts by the raw figure.
const COLUMNS: Column<RegisterLine>[] = [
  { key: 'workerId', header: 'Worker', render: (l) => l.workerId },
  {
    key: 'daysWorked',
    header: 'Days',
    numeric: true,
    render: (l) => l.daysWorked,
  },
  {
    key: 'grossWage',
    header: 'Gross',
    numeric: true,
    render: (l) => rupees(l.grossWage),
  },
  {
    key: 'netPayable',
    header: 'Net',
    numeric: true,
    render: (l) => rupees(l.netPayable),
  },
  {
    key: 'paymentMode',
    header: 'Mode',
    render: (l) => (l.paymentMode ? labourLabel(l.paymentMode) : '—'),
  },
  {
    key: 'status',
    header: 'Status',
    render: (l) => <StatusBadge status={l.status} />,
  },
];

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
    queryFn: () =>
      getPaymentRegister({
        projectId,
        periodFrom,
        periodTo,
      }),
    enabled: submitted && !!projectId && !!periodFrom && !!periodTo,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Payment Register" />
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
            intent="read"
            className="w-full justify-center"
            onClick={() => setSubmitted(true)}
            disabled={!projectId || !periodFrom || !periodTo}
          >
            Run
          </Button>
        </div>
      </div>

      {/* The shared table: sortable by any column (2026-10-15). */}
      {report.data && (
        <DataTable<RegisterLine>
          caption="Payment register"
          // A worker can appear twice on one sheet's register, so the position keeps keys unique.
          rows={report.data.lines.map((l, i) => ({
            ...l,
            rowKey: `${l.sheetId}-${l.workerId}-${i}`,
          }))}
          rowKey={(l) => l.rowKey}
          columns={COLUMNS}
          emptyMessage="No payment sheet lines for this project in the period."
        />
      )}
    </div>
  );
}
