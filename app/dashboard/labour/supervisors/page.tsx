'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  getSupervisorSites,
  setSupervisorSites,
  type LabourSiteOption,
  type SupervisorAssignment,
} from '@/app/lib/api/labour';
import { getCurrentUser } from '@/app/lib/api/users';
import AccessDenied from '@/app/ui/access-denied';
import { Button } from '@/app/ui/button';
import PageHeader from '@/app/ui/page-header';
import { FormError, SecondaryButton } from '@/app/ui/settings/form-fields';
import { LoadingText } from '@/app/ui/spinner';

/**
 * Which sites each supervisor works (031). A supervisor sees, registers and marks labour only at
 * the sites ticked here. Everyone with labour attendance access is listed; HR-office accounts
 * (Labour Approve) see every site regardless, so they need no ticks.
 */
export default function SupervisorsPage() {
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const data = useQuery({
    queryKey: ['labour', 'supervisor-sites'],
    queryFn: getSupervisorSites,
  });

  if (user.data && !user.data.permissions.includes('LABOUR_APPROVE')) {
    return (
      <AccessDenied detail="Supervisor sites are assigned by the HR office (Labour Approve permission)." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervisors"
        description="Tick the sites each supervisor marks attendance at. They will see only those sites' labour."
      />
      {data.isPending ? (
        <p className="text-sm text-gray-500" role="status">
          <LoadingText />
        </p>
      ) : data.isError ? (
        <FormError message="Could not load supervisors." />
      ) : data.data.supervisors.length === 0 ? (
        <p className="rounded-md bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
          Nobody has labour attendance access yet. Give a role the Daily Worker Registry
          permission under Settings → Roles, then assign that role to your supervisors.
        </p>
      ) : data.data.sites.length === 0 ? (
        <p className="rounded-md bg-gray-50 px-3 py-6 text-center text-sm text-gray-500">
          No sites yet. Sites are added under Projects.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.data.supervisors.map((s) => (
            <SupervisorCard key={s.userId} supervisor={s} sites={data.data.sites} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SupervisorCard({
  supervisor,
  sites,
}: {
  supervisor: SupervisorAssignment;
  sites: LabourSiteOption[];
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(supervisor.siteIds),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    selected.size !== supervisor.siteIds.length ||
    supervisor.siteIds.some((id) => !selected.has(id));

  const save = useMutation({
    mutationFn: () => setSupervisorSites(supervisor.userId, Array.from(selected)),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({
        queryKey: ['labour', 'supervisor-sites'],
      });
    },
    onError: (e) =>
      setError(e instanceof ApiError ? e.message : 'Could not save.'),
  });

  const toggle = (id: string) => {
    setSaved(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{supervisor.name}</h2>
        <span className="text-xs text-gray-500">
          {selected.size === 0
            ? 'No sites — sees no labour'
            : `${selected.size} site${selected.size === 1 ? '' : 's'}`}
        </span>
      </div>
      <FormError message={error} />
      <fieldset>
        <legend className="sr-only">Sites for {supervisor.name}</legend>
        <div className="flex flex-wrap gap-2">
          {sites.map((site) => {
            const on = selected.has(site.id);
            return (
              <label
                key={site.id}
                className={clsx(
                  'flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-500',
                  on
                    ? 'border-blue-600 bg-blue-50 text-blue-800'
                    : 'border-gray-300 bg-white text-gray-700',
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={on}
                  onChange={() => toggle(site.id)}
                />
                {site.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="mt-3 flex items-center gap-2">
        <Button
          onClick={() => {
            setError(null);
            save.mutate();
          }}
          disabled={!dirty || save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        {dirty && (
          <SecondaryButton
            onClick={() => {
              setSelected(new Set(supervisor.siteIds));
              setSaved(false);
            }}
          >
            Undo
          </SecondaryButton>
        )}
        {saved && !dirty && (
          <span role="status" className="text-sm text-green-700">
            Saved
          </span>
        )}
      </div>
    </li>
  );
}
