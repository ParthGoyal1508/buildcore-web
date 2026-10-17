'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import {
  createGang,
  getGangs,
  getMyLabourSites,
  searchWorkerOptions,
  type Gang,
} from '@/app/lib/api/labour';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import { Button, IconButton } from '@/app/ui/button';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import PageHeader from '@/app/ui/page-header';
import { useToast } from '@/app/ui/toast';

export default function GangsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  // 036 O13: the selected company is part of every key, so a company switch can never show the
  // previous company's gangs from the cache.
  const companyId = useSelectedCompanyId();
  const [showForm, setShowForm] = useState(false);

  // The labour sites the caller works with — the same list every other labour screen uses.
  const sites = useQuery({
    queryKey: ['labour', 'my-sites', companyId],
    queryFn: getMyLabourSites,
  });
  const gangs = useQuery({
    queryKey: ['gangs', companyId],
    queryFn: () => getGangs({}),
  });

  const siteName = (id: string) =>
    sites.data?.find((s) => s.id === id)?.name ?? '—';

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
        error={gangs.error}
        onRetry={gangs.refetch}
        emptyMessage="No gangs yet."
      />

      {showForm && (
        <GangForm
          sites={sites.data ?? []}
          companyId={companyId}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            toast.success('Gang created.');
            void queryClient.invalidateQueries({ queryKey: ['gangs'] });
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function GangForm({
  sites,
  companyId,
  onClose,
  onSaved,
}: {
  sites: { id: string; name: string }[];
  companyId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [siteId, setSiteId] = useState(sites.length === 1 ? sites[0].id : '');
  const [gangLeaderWorkerId, setGangLeaderWorkerId] = useState('');
  // Chosen members with their labels, so the chips can name them without another fetch.
  const [members, setMembers] = useState<SearchableOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createGang({
        name: name.trim(),
        siteId,
        gangLeaderWorkerId,
        memberWorkerIds: members.map((m) => m.id),
      }),
    onSuccess: onSaved,
    onError: (e) => setError(errorMessage(e, 'Could not create the gang.')),
  });

  // 036 O11: the leader and member pickers search the site's workers on the server; the old
  // checkbox list stopped at the first 200.
  const searchSite = (term: string, page: number) =>
    searchWorkerOptions(term, page, { siteId });

  return (
    <Modal
      title="New Gang"
      onClose={onClose}
      wide
      isDirty={!!name || !!gangLeaderWorkerId || members.length > 0}
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
            disabled={!name.trim() || !siteId || !gangLeaderWorkerId}
            loading={mutation.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormError message={error} />
        <TextField
          id="g-name"
          label="Gang name *"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <SelectField
          id="g-site"
          label="Site *"
          required
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value);
            setGangLeaderWorkerId('');
            setMembers([]);
          }}
        >
          <option value="">Select…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <div>
          <label
            htmlFor="g-leader"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Gang leader *
          </label>
          <AsyncSelect
            id="g-leader"
            value={gangLeaderWorkerId}
            onChange={(id) => setGangLeaderWorkerId(id)}
            search={searchSite}
            cacheKey={['labour-workers', companyId, siteId]}
            placeholder={siteId ? 'Search by name or labour code' : 'Pick a site first'}
            disabled={!siteId}
          />
        </div>
        {siteId && (
          <div>
            <label
              htmlFor="g-member"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Members
            </label>
            <AsyncSelect
              id="g-member"
              value=""
              onChange={(id, option) => {
                if (!option || members.some((m) => m.id === id)) return;
                setMembers((list) => [...list, option]);
              }}
              search={searchSite}
              cacheKey={['labour-workers', companyId, siteId]}
              placeholder="Add a member — search by name or code"
            />
            {members.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm"
                  >
                    {m.label}
                    {m.sublabel && (
                      <span className="text-xs text-gray-500">{m.sublabel}</span>
                    )}
                    <IconButton
                      size="sm"
                      label={`Remove ${m.label}`}
                      className="rounded-full"
                      onClick={() =>
                        setMembers((list) => list.filter((x) => x.id !== m.id))
                      }
                    >
                      ×
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                The leader is a member of their own gang; add anyone else here.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
