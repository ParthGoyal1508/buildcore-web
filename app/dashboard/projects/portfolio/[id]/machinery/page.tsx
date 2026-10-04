'use client';

import { PROJECT_SHELL_COPY } from '@/app/lib/constants';
import StatusBadge from '@/app/ui/status-badge';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

type Machine = ReturnType<typeof useProjectShell>['tabs']['machinery'][number];

/**
 * The machinery deployed to this project (008 US4, T024).
 *
 * The empty state is two different sentences on purpose. `unavailableModules` naming `plant`
 * means Plant & Machinery could not be consulted — the server distinguishes that from an answer
 * of none, and this is the screen where collapsing the two would do the damage: *No machinery
 * is deployed to this project* is a statement of fact, and nobody asked.
 */
export default function ProjectMachineryPage() {
  const { tabs, unavailableModules } = useProjectShell();
  const couldNotAsk = unavailableModules.includes('plant');

  const columns: Column<Machine>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => (
        <span className="whitespace-nowrap font-mono text-xs">{row.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Equipment',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'utilizationPercent',
      header: 'Utilisation',
      className: 'tabular-nums',
      render: (row) => `${Math.round(row.utilizationPercent)}%`,
    },
  ];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">
        {PROJECT_SHELL_COPY.machineryHeading}
      </h2>
      {couldNotAsk && (
        <p
          role="status"
          className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {PROJECT_SHELL_COPY.moduleUnavailable([
            PROJECT_SHELL_COPY.moduleNames.plant,
          ])}
        </p>
      )}
      <ResponsiveList
        columns={columns}
        rows={tabs.machinery}
        rowKey={(row) => row.id}
        emptyMessage={couldNotAsk ? '—' : PROJECT_SHELL_COPY.machineryEmpty}
      />
    </section>
  );
}
