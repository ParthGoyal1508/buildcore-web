'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getAttendanceModifications } from '@/app/lib/api/hr-payroll';
import { HR_MESSAGES, MESSAGES } from '@/app/lib/constants';
import { dateLabel, dateTimeLabel } from '@/app/lib/format';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { useEmployeeNames } from '@/app/ui/hr/use-employee-names';
import Modal from '@/app/ui/settings/modal';
import {
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';

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

/**
 * The administrative modification trail, filterable by who made the change (016 FR-012d).
 *
 * **The three filters compose; none replaces another.** That is the requirement, and the reason is
 * the question an audit is actually asked: not "what did this person change" and not "what happened
 * to this employee", but "what did this person change to this employee in September". Any one of
 * the three alone answers a question nobody has.
 *
 * The actor options come from the API rather than from the rows on screen, because options derived
 * from filtered rows collapse to the one already chosen.
 */
export default function ModificationsModal({ onClose }: { onClose: () => void }) {
  const employees = useEmployeeNames();
  const [employeeId, setEmployeeId] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filters = {
    pageSize: 100,
    ...(employeeId ? { employeeId } : {}),
    ...(actorUserId ? { actorUserId } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };

  const { data, isLoading, isError } = useQuery({
    // Every filter in the key, so changing one refetches rather than showing the last answer.
    queryKey: ['hr', 'attendanceModifications', filters],
    queryFn: () => getAttendanceModifications(filters),
  });

  const columns: Column<ModificationRow>[] = [
    {
      key: 'date',
      header: 'Attendance date',
      sticky: true,
      render: (row) => dateLabel(row.date),
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => employees.label(row.employeeId),
    },
    {
      key: 'from',
      header: 'Changed from',
      render: (row) => (
        <span className="text-red-700">{describe(row.before)}</span>
      ),
    },
    {
      key: 'to',
      header: 'Changed to',
      render: (row) => (
        <span className="text-green-700">{describe(row.after)}</span>
      ),
    },
    {
      key: 'actor',
      header: 'Changed by',
      // The name the server resolved. `actorUserId` is the fallback only so a row from an API
      // predating `actorName` still says something; it is never the intended rendering.
      render: (row) =>
        row.actorName ?? row.actorUserId ?? HR_MESSAGES.modificationActorUnknown,
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
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          id="mods-employee"
          label={HR_MESSAGES.modificationEmployeeFilter}
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
        >
          <option value="">{HR_MESSAGES.modificationAllEmployees}</option>
          {employees.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          id="mods-actor"
          label={HR_MESSAGES.modificationActorFilter}
          value={actorUserId}
          onChange={(event) => setActorUserId(event.target.value)}
        >
          <option value="">{HR_MESSAGES.modificationAllActors}</option>
          {(data?.actors ?? []).map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name}
            </option>
          ))}
        </SelectField>
        <TextField
          id="mods-from"
          label={HR_MESSAGES.modificationFrom}
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <TextField
          id="mods-to"
          label={HR_MESSAGES.modificationTo}
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>

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
