'use client';

import { PROJECT_SHELL_COPY } from '@/app/lib/constants';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import { useProjectShell } from '@/app/ui/projects/project-shell-context';

type Material = ReturnType<typeof useProjectShell>['tabs']['materials'][number];

/**
 * What stores has issued to this project (008 US4, T024).
 *
 * Quantities, not values: the aggregate carries `issuedQuantity` and no rate, and inventory
 * valuation belongs to the P&L, which has its own costing. The same "could not ask" rule as the
 * machinery section — see it for why the empty state is two sentences.
 */
export default function ProjectMaterialsPage() {
  const { tabs, unavailableModules } = useProjectShell();
  const couldNotAsk = unavailableModules.includes('inventory');

  const columns: Column<Material>[] = [
    {
      key: 'itemCode',
      header: 'Code',
      render: (row) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {row.itemCode}
        </span>
      ),
    },
    {
      key: 'itemName',
      header: 'Item',
      render: (row) => <span className="font-medium">{row.itemName}</span>,
    },
    {
      key: 'issuedQuantity',
      header: 'Issued',
      className: 'tabular-nums',
      render: (row) => `${row.issuedQuantity} ${row.unit}`,
    },
  ];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">
        {PROJECT_SHELL_COPY.materialsHeading}
      </h2>
      {couldNotAsk && (
        <p
          role="status"
          className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          {PROJECT_SHELL_COPY.moduleUnavailable([
            PROJECT_SHELL_COPY.moduleNames.inventory,
          ])}
        </p>
      )}
      <ResponsiveList
        columns={columns}
        rows={tabs.materials}
        rowKey={(row) => row.itemId}
        emptyMessage={couldNotAsk ? '—' : PROJECT_SHELL_COPY.materialsEmpty}
      />
    </section>
  );
}
