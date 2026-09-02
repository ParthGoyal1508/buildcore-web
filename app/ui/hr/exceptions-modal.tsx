'use client';

import { useQuery } from '@tanstack/react-query';

import { getAttendanceExceptions } from '@/app/lib/api/hr-payroll';
import { MESSAGES } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import DataTable, { StatusBadge, type Column } from '@/app/ui/hr/data-table';
import Modal from '@/app/ui/settings/modal';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

type ExceptionRow = Awaited<ReturnType<typeof getAttendanceExceptions>>[number];

/**
 * Unresolved face-match and geofence exceptions.
 *
 * Read-only here: resolving one is a decision about whether a punch counts, which
 * belongs on the punch itself rather than in a list dialog. This surfaces *what*
 * needs attention; the Mark/Edit flow is where an admin acts on it.
 */
export default function ExceptionsModal({ onClose }: { onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['hr', 'attendanceExceptions'],
    queryFn: getAttendanceExceptions,
  });

  const columns: Column<ExceptionRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sticky: true,
      render: (row) => row.name ?? row.employeeCode ?? row.employeeId,
    },
    {
      key: 'time',
      header: 'Punch time',
      render: (row) => dateTimeLabel(row.punchAt ?? row.punchTime ?? null),
    },
    {
      key: 'distance',
      header: 'Distance from site',
      numeric: true,
      render: (row) =>
        row.distanceMeters === null || row.distanceMeters === undefined
          ? '—'
          : `${Math.round(row.distanceMeters)} m`,
    },
    {
      key: 'face',
      header: 'Face match',
      render: (row) => <StatusBadge status={row.faceMatchResult ?? undefined} />,
    },
    {
      key: 'geofence',
      header: 'Geofence',
      render: (row) => <StatusBadge status={row.geofenceResult ?? undefined} />,
    },
  ];

  return (
    <Modal
      title="Attendance exceptions"
      onClose={onClose}
      wide
      footer={
        <SecondaryButton type="button" onClick={onClose}>
          Close
        </SecondaryButton>
      }
    >
      <DataTable
        caption="Attendance exceptions"
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={isError ? MESSAGES.loadFailed : null}
        emptyMessage="No unresolved exceptions."
      />
    </Modal>
  );
}
