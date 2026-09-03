'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { deleteProject, getClients, getProjects } from '@/app/lib/api/projects';
import {
  MESSAGES,
  PROJECT_STATUSES,
  ROUTES,
  projectsLabel,
} from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';
import ProjectListTable from '@/app/ui/projects/project-list-table';
import {
  RowAction,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

/** The project portfolio (spec US3). */
export default function PortfolioPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [clientId, setClientId] = useState('');
  const [page, setPage] = useState(1);
  const [rowError, setRowError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['projects', 'portfolio', { search, status, clientId, page }],
    queryFn: () => getProjects({ search, status, clientId, page }),
  });

  const { data: clients } = useQuery({
    queryKey: ['projects', 'clients', { pageSize: 200 }],
    queryFn: () => getClients({ pageSize: 200 }),
  });

  const removal = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      setRowError(null);
      queryClient.invalidateQueries({ queryKey: ['projects', 'portfolio'] });
      // The client list carries a projectCount that has just changed.
      queryClient.invalidateQueries({ queryKey: ['projects', 'clients'] });
    },
    onError: (error: unknown) =>
      setRowError(
        error instanceof ApiError && (error.status === 409 || error.status === 423)
          ? error.message
          : MESSAGES.saveFailed,
      ),
  });

  const pageCount = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Portfolio</h1>
        <Link
          href={ROUTES.projectsNewProject}
          className="flex h-10 items-center rounded-lg bg-blue-500 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          Add project
        </Link>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <TextField
          id="project-search"
          label="Search"
          placeholder="Project name or code"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <SelectField
          id="project-status-filter"
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {projectsLabel(value)}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="project-client-filter"
          label="Client"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All clients</option>
          {clients?.items.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </SelectField>
      </div>

      {rowError && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {rowError}
        </p>
      )}

      <ProjectListTable
        rows={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        isDeleting={removal.isPending}
        onDelete={(id) => removal.mutate(id)}
      />

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {data?.page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <RowAction disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </RowAction>
            <RowAction
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </RowAction>
          </div>
        </div>
      )}
    </main>
  );
}
