'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createWorker,
  deactivateWorker,
  getSkillCategories,
  getWorkers,
  type SkillCategory,
  type Worker,
} from '@/app/lib/api/labour';
import { getContractors, type Contractor } from '@/app/lib/api/partners';
import { getSites } from '@/app/lib/api/projects';
import { labourLabel } from '@/app/lib/constants';
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

export default function WorkersPage() {
  const queryClient = useQueryClient();
  const [siteId, setSiteId] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deactivating, setDeactivating] = useState<Worker | null>(null);

  const sites = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => getSites({ pageSize: 200 }),
  });
  const skills = useQuery({
    queryKey: ['skill-categories'],
    queryFn: () => getSkillCategories(),
  });
  const workers = useQuery({
    queryKey: ['workers', siteId, search],
    queryFn: () =>
      getWorkers({
        siteId: siteId || undefined,
        search: search || undefined,
        pageSize: 200,
      }),
  });

  const skillName = (id: string) =>
    skills.data?.find((s) => s.id === id)?.name ?? id;
  const siteName = (id: string) =>
    sites.data?.items.find((s) => s.id === id)?.name ?? id;

  const columns: Column<Worker>[] = [
    { key: 'code', header: 'Code', render: (w) => w.labourCode },
    { key: 'name', header: 'Name', render: (w) => w.fullName },
    { key: 'skill', header: 'Skill', render: (w) => skillName(w.skillCategoryId) },
    {
      key: 'engagement',
      header: 'Engagement',
      render: (w) => labourLabel(w.engagementType),
    },
    { key: 'site', header: 'Site', render: (w) => siteName(w.siteId) },
    {
      key: 'aadhaar',
      header: 'Aadhaar',
      render: (w) => w.aadhaarNumber ?? '—',
      hideOnCard: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (w) => <StatusBadge status={w.status} />,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Workers</h1>
          <p className="text-sm text-gray-500">
            The labour registry — Aadhaar and bank account are shown masked.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>New Worker</Button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          id="filter-site"
          label="Site"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">All sites</option>
          {sites.data?.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="filter-search"
          label="Search"
          placeholder="Name, code or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ResponsiveList
        columns={columns}
        rows={workers.data?.items ?? []}
        rowKey={(w) => w.id}
        isLoading={workers.isPending}
        error={workers.isError ? 'Could not load workers.' : null}
        emptyMessage="No workers match these filters."
        actions={(w) =>
          w.status === 'active' ? (
            <RowAction onClick={() => setDeactivating(w)}>Deactivate</RowAction>
          ) : null
        }
      />

      {showForm && (
        <WorkerForm
          sites={sites.data?.items ?? []}
          skills={skills.data ?? []}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['workers'] });
            setShowForm(false);
          }}
        />
      )}

      {deactivating && (
        <DeactivateForm
          worker={deactivating}
          onClose={() => setDeactivating(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['workers'] });
            setDeactivating(null);
          }}
        />
      )}
    </div>
  );
}

function WorkerForm({
  sites,
  skills,
  onClose,
  onSaved,
}: {
  sites: { id: string; name: string }[];
  skills: SkillCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [skillCategoryId, setSkillCategoryId] = useState('');
  const [engagementType, setEngagementType] = useState<'direct' | 'contractor'>(
    'direct',
  );
  const [contractorId, setContractorId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [rateOverride, setRateOverride] = useState('');
  const [error, setError] = useState<string | null>(null);

  const contractors = useQuery({
    queryKey: ['contractors'],
    queryFn: () => getContractors(),
    enabled: engagementType === 'contractor',
  });

  const mutation = useMutation({
    mutationFn: () =>
      createWorker({
        fullName,
        phone,
        gender,
        dateOfBirth,
        skillCategoryId,
        engagementType,
        contractorId:
          engagementType === 'contractor' ? contractorId : undefined,
        siteId,
        aadhaarNumber: aadhaarNumber || undefined,
        bankAccount: bankAccount || undefined,
        rateOverride: rateOverride ? Number(rateOverride) : undefined,
      }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(
        e instanceof ApiError ? e.message : 'Could not register the worker.',
      ),
  });

  const valid =
    fullName &&
    phone &&
    dateOfBirth &&
    skillCategoryId &&
    siteId &&
    (engagementType === 'direct' || contractorId);

  return (
    <Modal
      title="New Worker"
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!valid}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormError message={error} />
        <TextField
          id="w-name"
          label="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <TextField
          id="w-phone"
          label="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <SelectField
          id="w-gender"
          label="Gender"
          value={gender}
          onChange={(e) => setGender(e.target.value)}
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </SelectField>
        <TextField
          id="w-dob"
          label="Date of birth"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
        />
        <SelectField
          id="w-skill"
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
        <SelectField
          id="w-site"
          label="Site"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          <option value="">Select…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="w-engagement"
          label="Engagement type"
          value={engagementType}
          onChange={(e) =>
            setEngagementType(e.target.value as 'direct' | 'contractor')
          }
        >
          <option value="direct">Direct</option>
          <option value="contractor">Contractor</option>
        </SelectField>
        {engagementType === 'contractor' && (
          <SelectField
            id="w-contractor"
            label="Contractor"
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
          >
            <option value="">Select…</option>
            {contractors.data?.map((c: Contractor) => (
              <option key={c.id} value={c.vendorId}>
                {c.vendorName ?? c.vendorCode ?? c.vendorId}
              </option>
            ))}
          </SelectField>
        )}
        <TextField
          id="w-aadhaar"
          label="Aadhaar (optional)"
          value={aadhaarNumber}
          onChange={(e) => setAadhaarNumber(e.target.value)}
        />
        <TextField
          id="w-bank"
          label="Bank account (optional)"
          value={bankAccount}
          onChange={(e) => setBankAccount(e.target.value)}
        />
        <TextField
          id="w-override"
          label="Rate override (optional, ₹)"
          type="number"
          min="0"
          step="0.01"
          value={rateOverride}
          onChange={(e) => setRateOverride(e.target.value)}
        />
      </div>
    </Modal>
  );
}

function DeactivateForm({
  worker,
  onClose,
  onSaved,
}: {
  worker: Worker;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState('');
  const [lastWorkingDate, setLastWorkingDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => deactivateWorker(worker.id, { reason, lastWorkingDate }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(
        e instanceof ApiError ? e.message : 'Could not deactivate the worker.',
      ),
  });

  return (
    <Modal
      title={`Deactivate ${worker.fullName}`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <Button
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
            disabled={!reason || !lastWorkingDate}
          >
            Deactivate
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <p className="text-sm text-gray-600">
          The worker will be removed from their gang and excluded from future
          musters. Any unsettled payment lines are flagged for settlement.
        </p>
        <TextField
          id="d-date"
          label="Last working date"
          type="date"
          value={lastWorkingDate}
          onChange={(e) => setLastWorkingDate(e.target.value)}
        />
        <TextField
          id="d-reason"
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
}
