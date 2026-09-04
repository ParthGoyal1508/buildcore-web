'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  generatePaymentSheet,
  getPaymentSheets,
  type PaymentSheetListItem,
} from '@/app/lib/api/labour';
import { getProjects } from '@/app/lib/api/projects';
import { labourLabel, ROUTES } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

export default function PaymentSheetsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const projects = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => getProjects({ pageSize: 200 }),
  });
  const sheets = useQuery({
    queryKey: ['payment-sheets'],
    queryFn: () => getPaymentSheets(),
  });

  const projectName = (id: string) =>
    projects.data?.items.find((p) => p.id === id)?.name ?? id;

  const columns: Column<PaymentSheetListItem>[] = [
    { key: 'project', header: 'Project', render: (s) => projectName(s.projectId) },
    {
      key: 'period',
      header: 'Period',
      render: (s) => `${s.periodFrom} → ${s.periodTo}`,
    },
    {
      key: 'engagement',
      header: 'Engagement',
      render: (s) => labourLabel(s.engagementType),
    },
    { key: 'net', header: 'Net', render: (s) => rupees(s.netTotal) },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <StatusBadge status={s.status} label={labourLabel(s.status)} />
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Payment Sheets</h1>
          <p className="text-sm text-gray-500">
            Generate, approve and disburse cash payment sheets per project.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>Generate Sheet</Button>
      </div>

      <ResponsiveList
        columns={columns}
        rows={sheets.data ?? []}
        rowKey={(s) => s.id}
        isLoading={sheets.isPending}
        error={sheets.isError ? 'Could not load payment sheets.' : null}
        emptyMessage="No payment sheets yet."
        actions={(s) => (
          <Link href={ROUTES.labourPaymentSheet(s.id)}>
            <RowAction>Open</RowAction>
          </Link>
        )}
      />

      {showForm && (
        <GenerateSheetForm
          projects={projects.data?.items ?? []}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['payment-sheets'] });
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function GenerateSheetForm({
  projects,
  onClose,
  onSaved,
}: {
  projects: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [engagementType, setEngagementType] = useState<'direct' | 'contractor'>(
    'direct',
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      generatePaymentSheet({ projectId, periodFrom, periodTo, engagementType }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not generate the payment sheet.',
      ),
  });

  return (
    <Modal
      title="Generate Payment Sheet"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!projectId || !periodFrom || !periodTo}
          >
            Generate
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <SelectField
          id="gen-project"
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">Select…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="gen-from"
            label="Period from"
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
          <TextField
            id="gen-to"
            label="Period to"
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
          />
        </div>
        <SelectField
          id="gen-engagement"
          label="Engagement type"
          value={engagementType}
          onChange={(e) =>
            setEngagementType(e.target.value as 'direct' | 'contractor')
          }
        >
          <option value="direct">Direct</option>
          <option value="contractor">Contractor</option>
        </SelectField>
      </div>
    </Modal>
  );
}
