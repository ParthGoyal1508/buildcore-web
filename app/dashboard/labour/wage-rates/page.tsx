'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  createSkillCategory,
  createWageRate,
  deleteSkillCategory,
  getSkillCategories,
  getWageRates,
  type SkillCategory,
  type WageRate,
} from '@/app/lib/api/labour';
import { dateLabel, rupees } from '@/app/lib/format';
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
import { confirmDialog } from '@/app/ui/dialogs';
import { useToast } from '@/app/ui/toast';
import { ProjectPicker } from '@/app/ui/plant/pickers';

/** A daily rate the form accepts: above zero (036 O13 — negative and zero rates used to pass). */
function rateError(value: string): string | undefined {
  if (value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? undefined : 'Enter a rate above zero.';
}

export default function WageRatesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();
  const [projectId, setProjectId] = useState('');
  const [skillCategoryId, setSkillCategoryId] = useState('');
  const [asOf, setAsOf] = useState('');
  const [showRateForm, setShowRateForm] = useState(false);
  const [showMasters, setShowMasters] = useState(false);

  // `companyId` is in every key (036 O13 — the comment said so, the keys did not): without it
  // react-query serves one company's cached list to the next company selected. Projects are searched
  // on the server by the pickers (036 follow-up) — one page of 200 hid the 201st.
  const skills = useQuery({
    queryKey: ['skill-categories', companyId],
    queryFn: () => getSkillCategories(),
  });
  const rates = useQuery({
    queryKey: ['wage-rates', companyId, projectId, skillCategoryId, asOf],
    queryFn: () =>
      getWageRates({
        projectId: projectId || undefined,
        skillCategoryId: skillCategoryId || undefined,
        asOf: asOf || undefined,
      }),
  });

  const skillName = (id: string) =>
    skills.data?.find((s) => s.id === id)?.name ?? id;

  const columns: Column<WageRate>[] = [
    {
      key: 'project',
      header: 'Project',
      render: (r) => r.projectName ?? 'Unknown project',
    },
    {
      key: 'skill',
      header: 'Skill',
      render: (r) => skillName(r.skillCategoryId),
    },
    { key: 'rate', header: 'Daily Rate', render: (r) => rupees(r.dailyRate) },
    {
      key: 'from',
      header: 'Effective From',
      render: (r) => dateLabel(r.effectiveFrom),
    },
    {
      key: 'to',
      header: 'Effective To',
      render: (r) => dateLabel(r.effectiveTo),
    },
    {
      key: 'current',
      header: '',
      render: (r) =>
        r.isCurrent ? <StatusBadge status="active" label="Current" /> : null,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Wage Rates"
          description="Per-project daily rates by skill category, effective-dated."
        />
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setShowMasters(true)}>
            Skill Categories
          </SecondaryButton>
          <Button onClick={() => setShowRateForm(true)}>New Rate</Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ProjectPicker
          id="filter-project"
          label="Project"
          value={projectId}
          emptyLabel="All projects"
          onChange={(id) => setProjectId(id)}
        />
        <SelectField
          id="filter-skill"
          label="Skill category"
          value={skillCategoryId}
          onChange={(e) => setSkillCategoryId(e.target.value)}
        >
          <option value="">All skills</option>
          {skills.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="filter-asof"
          label="As of date"
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
        />
      </div>

      <ResponsiveList
        columns={columns}
        rows={rates.data ?? []}
        rowKey={(r) => r.id}
        isLoading={rates.isPending}
        error={rates.error}
        onRetry={rates.refetch}
        emptyMessage="No wage rates match these filters."
      />

      {showRateForm && (
        <WageRateForm
          skills={skills.data ?? []}
          onClose={() => setShowRateForm(false)}
          onSaved={() => {
            toast.success('Wage rate saved.');
            void queryClient.invalidateQueries({ queryKey: ['wage-rates'] });
            setShowRateForm(false);
          }}
        />
      )}

      {showMasters && (
        <SkillCategoryMasters
          skills={skills.data ?? []}
          onClose={() => setShowMasters(false)}
          onChanged={() =>
            queryClient.invalidateQueries({ queryKey: ['skill-categories'] })
          }
        />
      )}
    </div>
  );
}

function WageRateForm({
  skills,
  onClose,
  onSaved,
}: {
  skills: SkillCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [projectId, setProjectId] = useState('');
  const [skillCategoryId, setSkillCategoryId] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createWageRate({
        // A cross-company caller has no company of their own for the backend to fall
        // back on, so a write from them must say which company it belongs to.
        projectId,
        skillCategoryId,
        dailyRate: Number(dailyRate),
        effectiveFrom,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e, 'Could not save the rate.')),
  });
  const amountError = rateError(dailyRate);

  return (
    <Modal
      title="New Wage Rate"
      onClose={onClose}
      isDirty={!!projectId || !!skillCategoryId || !!dailyRate || !!effectiveFrom}
      pending={mutation.isPending}
      // O15: buttons passed straight to the footer, so a phone stacks them full width.
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
            disabled={
              !projectId ||
              !skillCategoryId ||
              !dailyRate ||
              !effectiveFrom ||
              !!amountError
            }
            loading={mutation.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <ProjectPicker
          id="rate-project"
          label="Project"
          required
          value={projectId}
          onChange={(id) => setProjectId(id)}
        />
        <SelectField
          id="rate-skill"
          label="Skill category *"
          required
          value={skillCategoryId}
          onChange={(e) => setSkillCategoryId(e.target.value)}
        >
          <option value="">Select…</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="rate-amount"
          label="Daily rate (₹) *"
          type="number"
          inputMode="decimal"
          required
          min="0.01"
          step="0.01"
          value={dailyRate}
          onChange={(e) => setDailyRate(e.target.value)}
          error={amountError}
        />
        <TextField
          id="rate-from"
          label="Effective from *"
          required
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          hint="Rates are appended forward; an earlier date than an existing rate is rejected."
        />
      </div>
    </Modal>
  );
}

function SkillCategoryMasters({
  skills,
  onClose,
  onChanged,
}: {
  skills: SkillCategory[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [defaultDailyRate, setDefaultDailyRate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createSkillCategory({
        name: name.trim(),
        code: code.trim(),
        defaultDailyRate: defaultDailyRate
          ? Number(defaultDailyRate)
          : undefined,
      }),
    onSuccess: () => {
      setName('');
      setCode('');
      setDefaultDailyRate('');
      setError(null);
      onChanged();
    },
    onError: (e) => setError(errorMessage(e, 'Could not add the category.')),
  });

  // Which category's delete is in flight, so only its button locks.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => deleteSkillCategory(id),
    onMutate: (id) => setDeletingId(id),
    onSuccess: onChanged,
    onError: (e) =>
      setError(errorMessage(e, 'Could not delete this skill category.')),
    onSettled: () => setDeletingId(null),
  });
  const defaultRateError = rateError(defaultDailyRate);

  return (
    <Modal
      title="Skill Categories"
      onClose={onClose}
      wide
      pending={create.isPending || remove.isPending}
      isDirty={!!name || !!code || !!defaultDailyRate}
    >
      <div className="space-y-4">
        <FormError message={error} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <TextField
            id="sc-name"
            label="Name *"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            id="sc-code"
            label="Code *"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <TextField
            id="sc-rate"
            label="Default rate (₹)"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={defaultDailyRate}
            onChange={(e) => setDefaultDailyRate(e.target.value)}
            error={defaultRateError}
          />
          <div className="flex items-end">
            <Button
              onClick={() => create.mutate()}
              disabled={!name.trim() || !code.trim() || !!defaultRateError}
              loading={create.isPending}
              className="w-full justify-center"
            >
              Add
            </Button>
          </div>
        </div>

        <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
          {skills.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <span>
                {s.name} <span className="text-gray-500">({s.code})</span>
                {s.defaultDailyRate !== null && (
                  <span className="ml-2 text-gray-500">
                    {rupees(s.defaultDailyRate)}
                  </span>
                )}
              </span>
              <RowAction
                loading={deletingId === s.id}
                disabled={deletingId !== null}
                onClick={async () => {
                  if (
                    await confirmDialog({
                      // 036 O13: this deletes a skill category, not a wage rate.
                      title: `Delete the skill category "${s.name}"?`,
                      message: 'This cannot be undone.',
                      confirmLabel: 'Delete',
                      tone: 'danger',
                    })
                  )
                    remove.mutate(s.id);
                }}
              >
                Delete
              </RowAction>
            </li>
          ))}
          {skills.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">
              No skill categories yet.
            </li>
          )}
        </ul>
      </div>
    </Modal>
  );
}
