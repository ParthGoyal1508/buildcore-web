'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createGang,
  getGangs,
  getWorkers,
  type Gang,
  type Worker,
} from '@/app/lib/api/labour';
import { getSites } from '@/app/lib/api/projects';
import { Button } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import PageHeader from '@/app/ui/page-header';
import { useCompanyContext } from '@/app/ui/settings/company-context';

export default function GangsPage() {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const sites = useQuery({
    queryKey: ['sites', 'all', companyId],
    queryFn: () => getSites({ pageSize: 200 }),
  });
  const gangs = useQuery({
    queryKey: ['gangs', companyId],
    queryFn: () => getGangs(companyId ? { companyId } : {}),
  });

  const siteName = (id: string) =>
    sites.data?.items.find((s) => s.id === id)?.name ?? id;

  const columns: Column<Gang>[] = [
    { key: 'name', header: 'Name', render: (g) => g.name },
    { key: 'site', header: 'Site', render: (g) => siteName(g.siteId) },
    {
      key: 'members',
      header: 'Members',
      render: (g) => `${g.memberWorkerIds.length}`,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <PageHeader
          title="Gangs"
          description="Group workers under a leader for faster muster capture."
        />
        <Button onClick={() => setShowForm(true)}>New Gang</Button>
      </div>

      <ResponsiveList
        columns={columns}
        rows={gangs.data ?? []}
        rowKey={(g) => g.id}
        isLoading={gangs.isPending}
        error={gangs.isError ? 'Could not load gangs.' : null}
        emptyMessage="No gangs yet."
      />

      {showForm && (
        <GangForm
          sites={sites.data?.items ?? []}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['gangs'] });
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function GangForm({
  sites,
  onClose,
  onSaved,
}: {
  sites: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { companyId } = useCompanyContext();
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [gangLeaderWorkerId, setGangLeaderWorkerId] = useState('');
  const [memberWorkerIds, setMemberWorkerIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const workers = useQuery({
    queryKey: ['workers', 'gang', siteId, companyId],
    queryFn: () =>
      getWorkers({
        siteId,
        status: 'active',
        pageSize: 200,
        ...(companyId ? { companyId } : {}),
      }),
    enabled: !!siteId,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createGang({
        ...(companyId ? { companyId } : {}),
        name,
        siteId,
        gangLeaderWorkerId,
        memberWorkerIds,
      }),
    onSuccess: onSaved,
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not create the gang.'),
  });

  const toggle = (id: string) =>
    setMemberWorkerIds((ids) =>
      ids.includes(id) ? ids.filter((m) => m !== id) : [...ids, id],
    );

  return (
    <Modal
      title="New Gang"
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
            disabled={!name || !siteId || !gangLeaderWorkerId}
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <TextField
          id="g-name"
          label="Gang name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <SelectField
          id="g-site"
          label="Site"
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value);
            setGangLeaderWorkerId('');
            setMemberWorkerIds([]);
          }}
        >
          <option value="">Select…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="g-leader"
          label="Gang leader"
          value={gangLeaderWorkerId}
          onChange={(e) => setGangLeaderWorkerId(e.target.value)}
          disabled={!siteId}
        >
          <option value="">Select…</option>
          {workers.data?.items.map((w: Worker) => (
            <option key={w.id} value={w.id}>
              {w.fullName} ({w.labourCode})
            </option>
          ))}
        </SelectField>
        {siteId && (
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">Members</p>
            <div className="max-h-56 overflow-y-auto rounded-md border border-gray-100 p-2">
              {workers.data?.items.map((w: Worker) => (
                <label
                  key={w.id}
                  className="flex items-center gap-2 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={memberWorkerIds.includes(w.id)}
                    onChange={() => toggle(w.id)}
                  />
                  {w.fullName} ({w.labourCode})
                </label>
              ))}
              {(workers.data?.items.length ?? 0) === 0 && (
                <p className="p-2 text-sm text-gray-500">
                  No active workers at this site.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
