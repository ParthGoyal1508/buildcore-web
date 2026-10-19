'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createSiteWageRates,
  getMyLabourSites,
  getSiteWageRates,
  updateSiteWageRate,
  type LabourSiteOption,
  type SiteWageRate,
} from '@/app/lib/api/labour';
import { getCurrentUser } from '@/app/lib/api/users';
import { LABOUR_GENDER_LABELS } from '@/app/lib/constants';
import { rupees, todayIso } from '@/app/lib/format';
import AccessDenied from '@/app/ui/access-denied';
import { Button } from '@/app/ui/button';
import { promptDialog } from '@/app/ui/dialogs';
import PageHeader from '@/app/ui/page-header';
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

interface SiteRow {
  site: LabourSiteOption;
  male: SiteWageRate | undefined;
  female: SiteWageRate | undefined;
}

/**
 * The HR office's daily rates (031): one male and one female rate per site, from a date. A new
 * rate closes the previous one the day before it starts, so a payment sheet for an earlier period
 * still uses the rate in force then.
 */
export default function SiteRatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<SiteRow | null>(null);
  const [historySite, setHistorySite] = useState('');
  const [error, setError] = useState<string | null>(null);

  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const sites = useQuery({
    queryKey: ['labour', 'my-sites'],
    queryFn: getMyLabourSites,
  });
  const rates = useQuery({
    queryKey: ['labour', 'site-rates'],
    queryFn: () => getSiteWageRates(),
  });

  const correct = useMutation({
    mutationFn: ({ id, rate }: { id: string; rate: number }) =>
      updateSiteWageRate(id, rate),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['labour', 'site-rates'] }),
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not correct the rate.'),
  });

  if (user.data && !user.data.permissions.includes('LABOUR_APPROVE')) {
    return (
      <AccessDenied detail="Site rates are set by the HR office (Labour Approve permission)." />
    );
  }

  const current = (siteId: string, gender: 'male' | 'female') =>
    rates.data?.find(
      (r) => r.siteId === siteId && r.gender === gender && r.isCurrent,
    );
  const rows: SiteRow[] = (sites.data ?? []).map((site) => ({
    site,
    male: current(site.id, 'male'),
    female: current(site.id, 'female'),
  }));
  const siteName = (id: string) =>
    sites.data?.find((s) => s.id === id)?.name ?? 'Site';

  const rateCell = (r: SiteWageRate | undefined) =>
    r ? (
      <>
        {rupees(r.dailyRate)}
        <span className="ml-1 text-xs text-gray-500">from {r.effectiveFrom}</span>
      </>
    ) : (
      <span className="text-amber-700">Not set</span>
    );

  const columns: Column<SiteRow>[] = [
    { key: 'site', header: 'Site', render: (r) => r.site.name },
    {
      key: 'male',
      header: 'Male / day',
      render: (r) => rateCell(r.male),
      sortValue: (r) => r.male?.dailyRate ?? -1,
    },
    {
      key: 'female',
      header: 'Female / day',
      render: (r) => rateCell(r.female),
      sortValue: (r) => r.female?.dailyRate ?? -1,
    },
  ];

  const history = (rates.data ?? []).filter(
    (r) => !historySite || r.siteId === historySite,
  );
  const historyColumns: Column<SiteWageRate>[] = [
    { key: 'site', header: 'Site', render: (r) => siteName(r.siteId) },
    {
      key: 'gender',
      header: 'Gender',
      render: (r) => LABOUR_GENDER_LABELS[r.gender] ?? r.gender,
    },
    { key: 'rate', header: 'Daily rate', render: (r) => rupees(r.dailyRate) },
    { key: 'from', header: 'From', render: (r) => r.effectiveFrom },
    { key: 'to', header: 'To', render: (r) => r.effectiveTo ?? '—' },
    {
      key: 'current',
      header: '',
      sortable: false,
      render: (r) =>
        r.isCurrent ? <StatusBadge status="active" label="Current" /> : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Rates"
        description="The daily wage for male and female labour at each site. Payment sheets use the rate in force on each day worked."
      />
      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={rows}
        rowKey={(r) => r.site.id}
        isLoading={sites.isPending || rates.isPending}
        error={sites.isError || rates.isError ? 'Could not load site rates.' : null}
        emptyMessage="No sites yet. Sites are added under Projects."
        actions={(r) => (
          <RowAction onClick={() => setEditing(r)}>Set rates</RowAction>
        )}
      />

      <section className="space-y-3" aria-labelledby="rate-history">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="rate-history" className="text-base font-semibold text-gray-900">
            Rate history
          </h2>
          <div className="w-full sm:w-64">
            <SelectField
              id="history-site"
              label="Site"
              value={historySite}
              onChange={(e) => setHistorySite(e.target.value)}
            >
              <option value="">All sites</option>
              {sites.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
        <ResponsiveList
          columns={historyColumns}
          rows={history}
          rowKey={(r) => r.id}
          isLoading={rates.isPending}
          emptyMessage="No rates set yet."
          actions={(r) => (
            <RowAction
              onClick={async () => {
                setError(null);
                const value = await promptDialog({
                  title: 'Correct this rate',
                  message: `${siteName(r.siteId)}, ${
                    LABOUR_GENDER_LABELS[r.gender]
                  }, from ${r.effectiveFrom}. Use this only to fix a mistake; for a pay change, set a new rate from a later date.`,
                  label: 'Daily rate (₹)',
                  defaultValue: String(r.dailyRate),
                  inputMode: 'decimal',
                  required: true,
                });
                if (value === null) return;
                const rate = Number(value);
                if (!(rate > 0)) {
                  setError('Enter a daily rate above zero.');
                  return;
                }
                correct.mutate({ id: r.id, rate });
              }}
            >
              Correct
            </RowAction>
          )}
        />
      </section>

      {editing && (
        <SetRatesForm
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            void queryClient.invalidateQueries({
              queryKey: ['labour', 'site-rates'],
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SetRatesForm({
  row,
  onClose,
  onSaved,
}: {
  row: SiteRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso);
  const [male, setMale] = useState(row.male ? String(row.male.dailyRate) : '');
  const [female, setFemale] = useState(
    row.female ? String(row.female.dailyRate) : '',
  );
  const [error, setError] = useState<string | null>(null);

  // Only a rate that changed is sent, so re-saving an unchanged one does not start a new period.
  const changed = (value: string, existing: SiteWageRate | undefined) =>
    value.trim() !== '' && Number(value) !== existing?.dailyRate;
  const invalid = (value: string) =>
    value.trim() !== '' && !(Number(value) > 0) ? 'Enter an amount above zero.' : undefined;

  const save = useMutation({
    mutationFn: () =>
      createSiteWageRates({
        siteId: row.site.id,
        effectiveFrom,
        ...(changed(male, row.male) ? { maleRate: Number(male) } : {}),
        ...(changed(female, row.female) ? { femaleRate: Number(female) } : {}),
      }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not save the rates.'),
  });

  const nothingChanged = !changed(male, row.male) && !changed(female, row.female);

  return (
    <Modal
      title={`Rates — ${row.site.name}`}
      onClose={onClose}
      isDirty={!nothingChanged}
      pending={save.isPending}
      // O15 (036): buttons passed straight to the footer, so a phone stacks them full width.
      footer={
        <>
          <SecondaryButton onClick={onClose} disabled={save.isPending}>
            Cancel
          </SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              save.mutate();
            }}
            disabled={
              !effectiveFrom ||
              nothingChanged ||
              !!invalid(male) ||
              !!invalid(female)
            }
            loading={save.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="rate-male"
            label="Male, per day (₹)"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={male}
            onChange={(e) => setMale(e.target.value)}
            error={invalid(male)}
          />
          <TextField
            id="rate-female"
            label="Female, per day (₹)"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={female}
            onChange={(e) => setFemale(e.target.value)}
            error={invalid(female)}
          />
        </div>
        <TextField
          id="rate-from"
          label="Applies from"
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          hint="Days before this date keep the previous rate."
        />
      </div>
    </Modal>
  );
}
