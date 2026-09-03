'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  Client,
  ClientListItem,
  deleteClient,
  getClients,
} from '@/app/lib/api/projects';
import { CLIENT_STATUSES, MESSAGES, projectsLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { lusitana } from '@/app/ui/fonts';
import ClientModal from '@/app/ui/projects/client-modal';
import StatusBadge from '@/app/ui/projects/status-badge';
import {
  RowAction,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';

/**
 * The client master (spec US1).
 *
 * Delete is disabled outright when `projectCount > 0` rather than left enabled to
 * fail: the backend refuses with a 409 either way, but a button that cannot work is
 * better shown as unavailable than as a trap. The 409 is still handled, because the
 * count is a snapshot and someone else may add a project between render and click.
 */
export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Client | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', 'clients', { search, status, page }],
    queryFn: () => getClients({ search, status, page }),
  });

  const removal = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      setRowError(null);
      queryClient.invalidateQueries({ queryKey: ['projects', 'clients'] });
    },
    onError: (error: unknown) => {
      setRowError(
        error instanceof ApiError && error.status === 409
          ? error.message
          : MESSAGES.saveFailed,
      );
    },
  });

  const columns: Column<ClientListItem>[] = [
    {
      key: 'name',
      header: 'Client',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    { key: 'contact', header: 'Contact person', render: (row) => row.contactPerson || '—' },
    { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
    { key: 'email', header: 'Email', render: (row) => row.email || '—', hideOnCard: true },
    { key: 'gstin', header: 'GSTIN', render: (row) => row.gstin || '—' },
    { key: 'projects', header: 'Projects', render: (row) => row.projectCount },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Clients</h1>
        <Button onClick={() => setIsAdding(true)}>Add client</Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <TextField
          id="client-search"
          label="Search"
          placeholder="Name, contact or GSTIN"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            // Otherwise a filtered result set shorter than the current page renders
            // as an empty list on a page that no longer exists.
            setPage(1);
          }}
        />
        <SelectField
          id="client-status-filter"
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          {CLIENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {projectsLabel(value)}
            </option>
          ))}
        </SelectField>
      </div>

      {rowError && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {rowError}
        </p>
      )}

      <ResponsiveList
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No clients yet. Add one to start a project."
        actions={(row) => (
          <>
            <RowAction
              onClick={() =>
                setEditing({
                  ...row,
                  // The list row omits these two; the modal needs them, and
                  // refetching one client to open a form the user already has the
                  // data for would be a round trip for nothing.
                  companyId: '',
                  address: null,
                })
              }
            >
              Edit
            </RowAction>
            <RowAction
              disabled={row.projectCount > 0 || removal.isPending}
              title={row.projectCount > 0 ? MESSAGES.clientHasProjects : undefined}
              onClick={() => removal.mutate(row.id)}
            >
              Delete
            </RowAction>
          </>
        )}
      />

      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {data.page} of {Math.ceil(data.total / data.pageSize)}
          </span>
          <div className="flex gap-2">
            <RowAction disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </RowAction>
            <RowAction
              disabled={page >= Math.ceil(data.total / data.pageSize)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </RowAction>
          </div>
        </div>
      )}

      {(isAdding || editing) && (
        <ClientModal
          client={editing}
          onClose={() => {
            setIsAdding(false);
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}
