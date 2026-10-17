'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  generatePaymentSheet,
  getMyLabourSites,
  getPaymentSheets,
  type PaymentSheet,
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
import PageHeader from '@/app/ui/page-header';

export default function PaymentSheetsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const sites = useQuery({
    queryKey: ['labour', 'my-sites'],
    queryFn: getMyLabourSites,
  });
  // Pre-031 sheets were per project and carry no site; they are named by project.
  const projects = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => getProjects({ pageSize: 200 }),
    retry: false,
  });
  const sheets = useQuery({
    queryKey: ['payment-sheets'],
    queryFn: () => getPaymentSheets({}),
  });

  const placeName = (s: PaymentSheetListItem) =>
    s.siteId
      ? sites.data?.find((x) => x.id === s.siteId)?.name ?? 'Site'
      : `${
          projects.data?.items.find((p) => p.id === s.projectId)?.name ??
          'Project'
        } (project sheet)`;

  const columns: Column<PaymentSheetListItem>[] = [
    { key: 'site', header: 'Site', render: placeName },
    {
      key: 'period',
      header: 'Dates',
      render: (s) => `${s.periodFrom} → ${s.periodTo}`,
    },
    { key: 'net', header: 'Net payable', render: (s) => rupees(s.netTotal) },
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
        <PageHeader
          title="Payment Sheets"
          description="Generate a site's labour payment sheet for any dates, priced at the site's male and female daily rates."
        />
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
            <RowAction intent="read">Open</RowAction>
          </Link>
        )}
      />

      {showForm && (
        <GenerateSheetForm
          sites={sites.data ?? []}
          onClose={() => setShowForm(false)}
          onSaved={(sheet) => {
            void queryClient.invalidateQueries({ queryKey: ['payment-sheets'] });
            setShowForm(false);
            router.push(ROUTES.labourPaymentSheet(sheet.id));
          }}
        />
      )}
    </div>
  );
}

/** The first and last day of the current month, as the default range. */
function thisMonth(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return { from: `${ym}-01`, to: `${ym}-${pad(last)}` };
}

function GenerateSheetForm({
  sites,
  onClose,
  onSaved,
}: {
  sites: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (sheet: PaymentSheet) => void;
}) {
  const [siteId, setSiteId] = useState(sites.length === 1 ? sites[0].id : '');
  const [periodFrom, setPeriodFrom] = useState(() => thisMonth().from);
  const [periodTo, setPeriodTo] = useState(() => thisMonth().to);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => generatePaymentSheet({ siteId, periodFrom, periodTo }),
    onSuccess: onSaved,
    // The 409s name exactly what is missing ("No female daily rate is set for …"), which is
    // the instruction HR needs, so the server's sentence is shown here.
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not generate the payment sheet.',
      ),
  });

  const rangeError =
    periodFrom && periodTo && periodTo < periodFrom
      ? 'The "to" date must be on or after the "from" date.'
      : undefined;

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
            disabled={
              !siteId || !periodFrom || !periodTo || !!rangeError || mutation.isPending
            }
          >
            {mutation.isPending ? 'Generating…' : 'Generate'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <SelectField
          id="gen-site"
          label="Site"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">Select a site…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="gen-from"
            label="From"
            type="date"
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
          <TextField
            id="gen-to"
            label="To"
            type="date"
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            error={rangeError}
          />
        </div>
        <p className="text-xs text-gray-500">
          Punched in and out counts as a full day, punched in only as a half day.
        </p>
      </div>
    </Modal>
  );
}
