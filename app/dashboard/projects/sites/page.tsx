'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  Site,
  deleteSite,
  getProjects,
  getSites,
} from '@/app/lib/api/projects';
import { MESSAGES, SITE_STATUSES, projectsLabel } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import { lusitana } from '@/app/ui/fonts';
import SiteModal from '@/app/ui/projects/site-modal';
import StatusBadge from '@/app/ui/projects/status-badge';
import {
  RowAction,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';

/** The site master (spec US2). */
export default function SitesPage() {
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Site | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', 'sites', { search, projectId, status, page }],
    queryFn: () => getSites({ search, projectId, status, page }),
  });

  // Shares its key with the modal's picker, so opening the form after filtering
  // costs no second request.
  const { data: projects } = useQuery({
    queryKey: ['projects', 'portfolio', { pageSize: 200 }],
    queryFn: () => getProjects({ pageSize: 200 }),
  });

  const projectName = (id: string | null) => {
    if (!id) return '—';
    const match = projects?.items.find((p) => p.id === id);
    // The id itself is a poor label, so say what is actually true — the project
    // exists but this list has not loaded it.
    return match ? `${match.code} — ${match.name}` : 'Linked project';
  };

  const removal = useMutation({
    mutationFn: (id: string) => deleteSite(id),
    onSuccess: () => {
      setRowError(null);
      queryClient.invalidateQueries({ queryKey: ['projects', 'sites'] });
    },
    onError: (error: unknown) =>
      setRowError(
        error instanceof ApiError && error.status === 409
          ? error.message
          : MESSAGES.saveFailed,
      ),
  });

  const columns: Column<Site>[] = [
    {
      key: 'name',
      header: 'Site',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'project',
      header: 'Project',
      render: (row) => projectName(row.projectId),
    },
    {
      key: 'address',
      header: 'Location',
      render: (row) => row.address || '—',
    },
    {
      key: 'radius',
      header: 'Geofence',
      render: (row) => `${row.geofenceRadiusMeters} m`,
    },
    {
      key: 'coords',
      header: 'Coordinates',
      hideOnCard: true,
      render: (row) => (
        <span className="tabular-nums text-xs text-gray-600">
          {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Sites</h1>
        <Button onClick={() => setIsAdding(true)}>Add site</Button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <TextField
          id="site-search"
          label="Search"
          placeholder="Site name"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <SelectField
          id="site-project-filter"
          label="Project"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All projects</option>
          {projects?.items.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} — {project.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="site-status-filter"
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          {SITE_STATUSES.map((value) => (
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
        emptyMessage="No sites yet. Add one so employees have somewhere to punch in."
        actions={(row) => (
          <>
            <RowAction onClick={() => setEditing(row)}>Edit</RowAction>
            {/* Not pre-disabled like the client delete: whether a site is in use
                depends on employee postings this list has no count of, so the only
                honest answer comes from trying. */}
            <RowAction
              disabled={removal.isPending}
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
        <SiteModal
          site={editing}
          onClose={() => {
            setIsAdding(false);
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}
