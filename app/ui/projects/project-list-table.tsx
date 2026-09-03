'use client';

import { LockClosedIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

import { ProjectListItem } from '@/app/lib/api/projects';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { formatDateToLocal, formatRupees } from '@/app/lib/utils';
import StatusBadge from '@/app/ui/status-badge';
import { RowAction } from '@/app/ui/settings/form-fields';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';

/**
 * The portfolio list (spec FR-010, FR-014).
 *
 * Built on `ResponsiveList`, so the same column definitions render as a table on
 * desktop and as stacked cards on a phone — a nine-column table at 320px would
 * either scroll sideways or crush every column.
 *
 * A locked project keeps its Edit link: unlocking happens on the edit form, so
 * removing the way in would make the lock permanent. Delete is what the lock stops,
 * and the server refuses it regardless.
 */
export default function ProjectListTable({
  rows,
  isLoading,
  isError,
  onDelete,
  isDeleting,
}: {
  rows: ProjectListItem[];
  isLoading: boolean;
  isError: boolean;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const columns: Column<ProjectListItem>[] = [
    {
      key: 'code',
      header: 'Code',
      render: (row) => (
        <span className="whitespace-nowrap font-mono text-xs">{row.code}</span>
      ),
    },
    {
      key: 'name',
      header: 'Project',
      render: (row) => (
        <span className="flex items-center gap-1.5 font-medium">
          {row.name}
          {row.isLocked && (
            <LockClosedIcon
              className="w-4 shrink-0 text-gray-500"
              // Not `aria-hidden`: the lock is the only thing distinguishing an
              // editable project from a frozen one, so it has to be announced.
              aria-label="Locked"
              role="img"
            />
          )}
        </span>
      ),
    },
    { key: 'client', header: 'Client', render: (row) => row.client },
    {
      key: 'location',
      header: 'Location',
      render: (row) => row.location || '—',
      hideOnCard: true,
    },
    {
      key: 'contractValue',
      header: 'Contract value',
      // `tabular-nums` so the digits line up column-wise; without it, proportional
      // figures make two similar amounts hard to compare at a glance.
      className: 'tabular-nums',
      render: (row) => formatRupees(row.contractValue),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'startDate',
      header: 'Start',
      render: (row) => formatDateToLocal(row.startDate),
    },
    {
      key: 'endDate',
      header: 'Expected end',
      render: (row) =>
        row.expectedEndDate ? formatDateToLocal(row.expectedEndDate) : '—',
      hideOnCard: true,
    },
  ];

  return (
    <ResponsiveList
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      isLoading={isLoading}
      error={isError ? MESSAGES.loadFailed : null}
      emptyMessage="No projects yet. Add one to start tracking work."
      actions={(row) => (
        <>
          <Link
            href={ROUTES.projectsEditProject(row.id)}
            className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Edit
          </Link>
          <RowAction
            disabled={row.isLocked || isDeleting}
            title={row.isLocked ? MESSAGES.projectLocked : undefined}
            onClick={() => onDelete(row.id)}
          >
            Delete
          </RowAction>
        </>
      )}
    />
  );
}
