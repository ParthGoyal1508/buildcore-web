'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import {
  type DwrProject,
  dwrProjectsKey,
  listDwrProjects,
} from '@/app/lib/api/dwr';
import { ROUTES } from '@/app/lib/constants';
import PageHeader from '@/app/ui/page-header';
import { TextField } from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import StatusBadge from '@/app/ui/status-badge';

const COLUMNS: Column<DwrProject>[] = [
  {
    key: 'code',
    header: 'Code',
    render: (row) => <span className="font-mono text-xs">{row.code}</span>,
  },
  { key: 'name', header: 'Project', render: (row) => row.name },
  { key: 'location', header: 'Location', render: (row) => row.location ?? '—' },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <span className="flex items-center gap-2">
        <StatusBadge status={row.status} />
        {row.isLocked && <span className="text-xs text-gray-500">Locked</span>}
      </span>
    ),
  },
];

/**
 * Daily work reports: pick a project (039).
 *
 * The way in for whoever records the day's work. The DWR Entry role holds `DWR` and nothing of the
 * portfolio, so the portfolio list — which needs `PROJECTS` and carries the contract value — was
 * not theirs to open, and with it went every route to a project's reports. This lists the projects
 * from `GET /projects/dwr/projects`, which `DWR` may read, and a row opens that project's reports.
 */
export default function DwrProjectsPage() {
  const [search, setSearch] = useState('');
  const query = useQuery({ queryKey: dwrProjectsKey, queryFn: listDwrProjects });

  const needle = search.trim().toLowerCase();
  const rows = (query.data ?? []).filter(
    (row) =>
      !needle ||
      row.name.toLowerCase().includes(needle) ||
      row.code.toLowerCase().includes(needle),
  );

  return (
    <main className="flex flex-col gap-4">
      <PageHeader
        title="Daily Work Reports"
        description="Pick a project to record, submit or correct its daily work reports."
      />
      <div className="max-w-sm">
        <TextField
          id="dwr-project-search"
          label="Search"
          placeholder="Project name or code"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <ResponsiveList
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => ROUTES.projectsDwr(row.id)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : undefined}
        onRetry={query.refetch}
        emptyMessage={needle ? 'No project matches that search.' : 'No projects yet.'}
      />
    </main>
  );
}
