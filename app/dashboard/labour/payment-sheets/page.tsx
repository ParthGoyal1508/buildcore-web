'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  generatePaymentSheet,
  getLabourDayRules,
  getMyLabourSites,
  getPaymentSheets,
  type PaymentSheet,
  type PaymentSheetListItem,
} from '@/app/lib/api/labour';
import { getProjects } from '@/app/lib/api/projects';
import { labourLabel, ROUTES } from '@/app/lib/constants';
import { dateLabel, rupees, todayIso } from '@/app/lib/format';
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
      render: (s) => `${dateLabel(s.periodFrom)} → ${dateLabel(s.periodTo)}`,
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
        error={sheets.error}
        onRetry={sheets.refetch}
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

/**
 * The day before today in India time, as `YYYY-MM-DD` — the latest a sheet may end (036 O3: a sheet
 * covering today would miss the punches still to come, and the server now refuses it with
 * `LABOUR_SHEET_PERIOD_NOT_ENDED`).
 */
function yesterdayIso(): string {
  const d = new Date(`${todayIso()}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Yesterday's month so far, as the default range: the 1st to yesterday. */
function defaultRange(): { from: string; to: string } {
  const to = yesterdayIso();
  return { from: `${to.slice(0, 7)}-01`, to };
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
  const [periodFrom, setPeriodFrom] = useState(() => defaultRange().from);
  const [periodTo, setPeriodTo] = useState(() => defaultRange().to);
  const [error, setError] = useState<string | null>(null);
  const latestEnd = yesterdayIso();

  // 036 O10: the help text reads the company's own thresholds (034), not a fixed sentence.
  const rules = useQuery({
    queryKey: ['labour', 'day-rules'],
    queryFn: () => getLabourDayRules(),
  });

  const mutation = useMutation({
    mutationFn: () => generatePaymentSheet({ siteId, periodFrom, periodTo }),
    onSuccess: onSaved,
    // The 409s name exactly what is missing ("No female daily rate is set for …"), which is
    // the instruction HR needs, so the server's sentence is shown here.
    onError: (e) =>
      setError(errorMessage(e, 'Could not generate the payment sheet.')),
  });

  const rangeError =
    periodFrom && periodTo && periodTo < periodFrom
      ? 'The "to" date must be on or after the "from" date.'
      : periodTo > latestEnd
      ? `A sheet must end by yesterday (${dateLabel(latestEnd)}) — today's punches are not in yet.`
      : undefined;

  return (
    <Modal
      title="Generate Payment Sheet"
      onClose={onClose}
      pending={mutation.isPending}
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!siteId || !periodFrom || !periodTo || !!rangeError}
            loading={mutation.isPending}
          >
            {mutation.isPending ? 'Generating…' : 'Generate'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <SelectField
          id="gen-site"
          label="Site *"
          required
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
            label="From *"
            type="date"
            required
            max={periodTo || latestEnd}
            value={periodFrom}
            onChange={(e) => setPeriodFrom(e.target.value)}
          />
          <TextField
            id="gen-to"
            label="To *"
            type="date"
            required
            max={latestEnd}
            value={periodTo}
            onChange={(e) => setPeriodTo(e.target.value)}
            error={rangeError}
          />
        </div>
        <DayRulesHelp rules={rules.data} />
      </div>
    </Modal>
  );
}

/**
 * How the sheet counts a day (036 O10). Rewritten from the hours-based day rules of 034: the old
 * sentence ("punched in only is a half day") described the rule 034 replaced, and was wrong for
 * every company since. The figures are the company's own when they have loaded.
 */
function DayRulesHelp({
  rules,
}: {
  rules?: { fullDayHours: number; halfDayHours: number; standardHours: number };
}) {
  const full = rules ? `${rules.fullDayHours} hours` : 'the full-day hours';
  const half = rules ? `${rules.halfDayHours} hours` : 'the half-day hours';
  return (
    <ul className="list-disc space-y-1 pl-4 text-xs text-gray-500">
      <li>
        Each day is counted from the hours between punch in and punch out: {full} or
        more is a full day, {half} or more a half day, and less is not paid.
      </li>
      {rules && rules.standardHours > 0 && (
        <li>Hours beyond {rules.standardHours} in a day are paid as overtime.</li>
      )}
      <li>
        A day with a missing punch must be corrected under Muster attendance first, and
        the sheet must end by yesterday.
      </li>
      <li>
        Anything short-paid on an earlier sheet is added as a &ldquo;Balance carried
        forward&rdquo; line.
      </li>
    </ul>
  );
}
