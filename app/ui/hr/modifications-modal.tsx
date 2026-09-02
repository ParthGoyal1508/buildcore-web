'use client';

import { useQuery } from '@tanstack/react-query';

import { getAttendanceModifications } from '@/app/lib/api/hr-payroll';
import { MESSAGES } from '@/app/lib/constants';
import { dateLabel, dateTimeLabel } from '@/app/lib/format';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import Modal from '@/app/ui/settings/modal';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

type ModificationRow = Awaited<
  ReturnType<typeof getAttendanceModifications>
>['items'][number];

/**
 * Renders a stored before/after blob as readable text.
 *
 * The backend stores whatever changed as JSON rather than as fixed columns, so
 * this has to cope with an arbitrary object. Showing raw JSON would technically be
 * accurate and useless — the point of this dialog is that someone can read what
 * happened without decoding it.
 */
function describe(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value !== 'object') return String(value);
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  );
  if (entries.length === 0) return '—';
  return entries.map(([key, v]) => `${key}: ${String(v)}`).join(', ');
}

export default function ModificationsModal({ onClose }: { onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'attendanceModifications'],
    queryFn: () => getAttendanceModifications({ pageSize: 100 }),
  });

  const columns: Column<ModificationRow>[] = [
    {
      key: 'date',
      header: 'Attendance date',
      sticky: true,
      render: (row) => dateLabel(row.date),
    },
    { key: 'employee', header: 'Employee', render: (row) => row.employeeId },
    {
      key: 'from',
      header: 'Changed from',
      render: (row) => (
        <span className="text-red-700">{describe(row.changedFrom)}</span>
      ),
    },
    {
      key: 'to',
      header: 'Changed to',
      render: (row) => (
        <span className="text-green-700">{describe(row.changedTo)}</span>
      ),
    },
    {
      key: 'when',
      header: 'Recorded',
      render: (row) => dateTimeLabel(row.createdAt),
    },
  ];

  return (
    <Modal
      title="Attendance modifications"
      onClose={onClose}
      wide
      footer={
        <SecondaryButton type="button" onClick={onClose}>
          Close
        </SecondaryButton>
      }
    >
      <DataTable
        caption="Attendance modifications"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No attendance has been manually edited."
      />
    </Modal>
  );
}
