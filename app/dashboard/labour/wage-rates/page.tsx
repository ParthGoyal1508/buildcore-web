'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createSkillCategory,
  createWageRate,
  deleteSkillCategory,
  getSkillCategories,
  getWageRates,
  type SkillCategory,
  type WageRate,
} from '@/app/lib/api/labour';
import { getProjects } from '@/app/lib/api/projects';
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

export default function WageRatesPage() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState('');
  const [skillCategoryId, setSkillCategoryId] = useState('');
  const [asOf, setAsOf] = useState('');
  const [showRateForm, setShowRateForm] = useState(false);
  const [showMasters, setShowMasters] = useState(false);

  const projects = useQuery({
    queryKey: ['projects', 'all'],
    queryFn: () => getProjects({ pageSize: 200 }),
  });
  const skills = useQuery({
    queryKey: ['skill-categories'],
    queryFn: () => getSkillCategories(),
  });
  const rates = useQuery({
    queryKey: ['wage-rates', projectId, skillCategoryId, asOf],
    queryFn: () =>
      getWageRates({
        projectId: projectId || undefined,
        skillCategoryId: skillCategoryId || undefined,
        asOf: asOf || undefined,
      }),
  });

  const skillName = (id: string) =>
    skills.data?.find((s) => s.id === id)?.name ?? id;
  const projectName = (id: string) =>
    projects.data?.items.find((p) => p.id === id)?.name ?? id;

  const columns: Column<WageRate>[] = [
    { key: 'project', header: 'Project', render: (r) => projectName(r.projectId) },
    { key: 'skill', header: 'Skill', render: (r) => skillName(r.skillCategoryId) },
    { key: 'rate', header: 'Daily Rate', render: (r) => rupees(r.dailyRate) },
    { key: 'from', header: 'Effective From', render: (r) => r.effectiveFrom },
    {
      key: 'to',
      header: 'Effective To',
      render: (r) => r.effectiveTo ?? '—',
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
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Wage Rates</h1>
          <p className="text-sm text-gray-500">
            Per-project daily rates by skill category, effective-dated.
          </p>
        </div>
        <div className="flex gap-2">
          <SecondaryButton onClick={() => setShowMasters(true)}>
            Skill Categories
          </SecondaryButton>
          <Button onClick={() => setShowRateForm(true)}>New Rate</Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField
          id="filter-project"
          label="Project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">All projects</option>
          {projects.data?.items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
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
        error={rates.isError ? 'Could not load wage rates.' : null}
        emptyMessage="No wage rates match these filters."
      />

      {showRateForm && (
        <WageRateForm
          projects={projects.data?.items ?? []}
          skills={skills.data ?? []}
          onClose={() => setShowRateForm(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['wage-rates'] });
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
  projects,
  skills,
  onClose,
  onSaved,
}: {
  projects: { id: string; name: string }[];
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
        projectId,
        skillCategoryId,
        dailyRate: Number(dailyRate),
        effectiveFrom,
      }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not save the rate.'),
  });

  return (
    <Modal
      title="New Wage Rate"
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
              !projectId || !skillCategoryId || !dailyRate || !effectiveFrom
            }
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <SelectField
          id="rate-project"
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
        <SelectField
          id="rate-skill"
          label="Skill category"
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
          label="Daily rate (₹)"
          type="number"
          min="0"
          step="0.01"
          value={dailyRate}
          onChange={(e) => setDailyRate(e.target.value)}
        />
        <TextField
          id="rate-from"
          label="Effective from"
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
        name,
        code,
        defaultDailyRate: defaultDailyRate ? Number(defaultDailyRate) : undefined,
      }),
    onSuccess: () => {
      setName('');
      setCode('');
      setDefaultDailyRate('');
      setError(null);
      onChanged();
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not add the category.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSkillCategory(id),
    onSuccess: onChanged,
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? e.message
          : 'Could not delete this skill category.',
      ),
  });

  return (
    <Modal title="Skill Categories" onClose={onClose} wide>
      <div className="space-y-4">
        <FormError message={error} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <TextField
            id="sc-name"
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            id="sc-code"
            label="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <TextField
            id="sc-rate"
            label="Default rate (₹)"
            type="number"
            min="0"
            step="0.01"
            value={defaultDailyRate}
            onChange={(e) => setDefaultDailyRate(e.target.value)}
          />
          <div className="flex items-end">
            <Button
              onClick={() => create.mutate()}
              disabled={!name || !code}
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
                {s.name} <span className="text-gray-400">({s.code})</span>
                {s.defaultDailyRate !== null && (
                  <span className="ml-2 text-gray-500">
                    {rupees(s.defaultDailyRate)}
                  </span>
                )}
              </span>
              <RowAction onClick={() => remove.mutate(s.id)}>Delete</RowAction>
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
