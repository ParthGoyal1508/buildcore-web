'use client';

import { LockClosedIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

import { ProjectListItem } from '@/app/lib/api/projects';
import { MESSAGES, ROUTES } from '@/app/lib/constants';
import { formatDateToLocal, formatRupees } from '@/app/lib/utils';
import StatusBadge from '@/app/ui/status-badge';
import { RowAction, RowActionLink } from '@/app/ui/settings/form-fields';
import ResponsiveList, { Column } from '@/app/ui/settings/responsive-list';
import { confirmDialog } from '@/app/ui/dialogs';

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
          {/*
            The name is the way in. It was plain text until 2026-10-04, when clicking a project
            did nothing and `/portfolio/<id>` was a 404 — which is why this row had grown six
            section links instead.
          */}
          <Link
            href={ROUTES.projectsProject(row.id)}
            className="text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {row.name}
          </Link>
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
      key: 'documents',
      header: 'Documents',
      /**
       * Paperwork readiness, visible without opening the project (017 FR-008).
       *
       * The gap this closes: missing project paperwork surfaces months later as an
       * unbillable claim or an uninsured site, and the only way to find it was to open
       * every project one at a time.
       *
       * Absent when the caller did not ask for it — "not asked" and "nothing required"
       * are different answers and must not render the same.
       */
      render: (row) => {
        const readiness = row.documentReadiness;
        if (!readiness) return <span className="text-gray-400">—</span>;
        if (readiness.required === 0) {
          return <span className="text-xs text-gray-500">None required</span>;
        }
        const complete = readiness.present === readiness.required;
        return (
          <span
            className={
              complete
                ? 'text-xs font-medium text-green-700'
                : 'text-xs font-medium text-amber-800'
            }
          >
            {readiness.present}/{readiness.required}
            {complete ? '' : ' on file'}
          </span>
        );
      },
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
          {/*
            One way in, not six — and since 2026-10-15 not even a button for it: the whole row opens
            the project (`RowLinks`), as the name always did, so an Open beside Edit and Delete only
            cost the width that, with icons on the buttons, pushed the list into scrolling.
          */}
          <RowActionLink href={ROUTES.projectsEditProject(row.id)}>
            Edit
          </RowActionLink>
          <RowAction
            disabled={row.isLocked || isDeleting}
            title={row.isLocked ? MESSAGES.projectLocked : undefined}
            // It deleted on the click until 2026-10-15, and a project goes with its documents, work
            // orders and bills.
            onClick={async () => {
              if (
                await confirmDialog({
                  title: `Delete ${row.name}?`,
                  message:
                    'The project goes, with its documents, work orders and bills. This cannot be undone.',
                  confirmLabel: 'Delete project',
                  tone: 'danger',
                  typeToConfirm: 'DELETE',
                })
              )
                onDelete(row.id);
            }}
          >
            Delete
          </RowAction>
        </>
      )}
    />
  );
}
