'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { listEmployees } from '@/app/lib/api/hr-payroll';
import { createLogbookEntry } from '@/app/lib/api/plant';
import { getProjects } from '@/app/lib/api/projects';
import { MESSAGES, formatReading } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import { usePlantEquipment } from './use-plant-refs';

/**
 * Record a day in the logbook.
 *
 * Total Hours is computed live and rendered read-only (web FR-002): it is
 * `closing − opening` and always will be, so an editable field could only ever
 * disagree with the two numbers above it. The same rule the backend applies when it
 * stores the value.
 */
export default function LogbookModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const equipment = usePlantEquipment();

  const employees = useQuery({
    queryKey: ['plant', 'employees'],
    queryFn: () => listEmployees({ isActive: true, pageSize: 200 }),
    select: (page) => page.items,
  });
  const projects = useQuery({
    queryKey: ['plant', 'projects'],
    queryFn: () => getProjects({ pageSize: 200 }),
    select: (page) => page.items,
  });

  const [equipmentId, setEquipmentId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [openingReading, setOpeningReading] = useState('');
  const [closingReading, setClosingReading] = useState('');
  const [fuelConsumed, setFuelConsumed] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const machine = equipment.data?.find((row) => row.id === equipmentId);
  const opening = Number(openingReading);
  const closing = Number(closingReading);
  const bothEntered = openingReading !== '' && closingReading !== '';
  const totalHours = bothEntered ? closing - opening : null;
  // Equal readings are legitimate — a machine that stood idle all day still gets an
  // entry, with zero hours. Only a *negative* span is refused.
  const readingsInvalid = bothEntered && closing < opening;

  const save = useMutation({
    mutationFn: () =>
      createLogbookEntry({
        equipmentId,
        date,
        openingReading: opening,
        closingReading: closing,
        ...(fuelConsumed ? { fuelConsumed: Number(fuelConsumed) } : {}),
        ...(operatorId ? { operatorId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
  });

  return (
    <Modal
      title="Record a day"
      onClose={onClose}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="logbook-form"
            disabled={save.isPending || readingsInvalid}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="logbook-form" onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        save.mutate();
      }} className="flex flex-col gap-4">
        <FormError message={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            id="logbook-equipment"
            label="Machine"
            required
            value={equipmentId}
            onChange={(event) => {
              const next = event.target.value;
              setEquipmentId(next);
              // Prefilled from the machine's current meter, because that is what
              // the opening reading almost always is. Set in the handler rather
              // than an effect so it never fights a value the operator typed.
              const selected = equipment.data?.find((row) => row.id === next);
              if (selected) setOpeningReading(String(selected.currentReading));
            }}
          >
            <option value="">Select a machine</option>
            {(equipment.data ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.code} · {row.name}
              </option>
            ))}
          </SelectField>

          <TextField
            id="logbook-date"
            label="Date"
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
            hint="One entry per machine per day."
          />

          <TextField
            id="logbook-opening"
            label="Opening reading"
            type="number"
            required
            min={0}
            step="0.001"
            value={openingReading}
            onChange={(event) => setOpeningReading(event.target.value)}
          />

          <TextField
            id="logbook-closing"
            label="Closing reading"
            type="number"
            required
            min={0}
            step="0.001"
            value={closingReading}
            onChange={(event) => setClosingReading(event.target.value)}
            error={
              readingsInvalid
                ? 'A meter does not run backwards — the closing reading cannot be lower.'
                : undefined
            }
          />

          {/* Read-only and computed (web FR-002): an editable Total Hours could
              only ever disagree with the two readings above it. */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Total hours
            </span>
            <p
              aria-live="polite"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            >
              {totalHours === null || readingsInvalid
                ? '—'
                : formatReading(totalHours, machine?.meterType ?? 'hours')}
            </p>
          </div>

          <TextField
            id="logbook-fuel"
            label="Fuel consumed (litres)"
            type="number"
            min={0}
            step="0.001"
            value={fuelConsumed}
            onChange={(event) => setFuelConsumed(event.target.value)}
            hint="What the operator recorded. Fuel variance is measured against this."
          />

          <SelectField
            id="logbook-operator"
            label="Operator"
            value={operatorId}
            onChange={(event) => setOperatorId(event.target.value)}
          >
            <option value="">Not recorded</option>
            {(employees.data ?? []).map((employee) => (
              <option key={employee.id} value={employee.id}>
                {[employee.firstName, employee.lastName]
                  .filter(Boolean)
                  .join(' ') || employee.employeeCode}
              </option>
            ))}
          </SelectField>

          <SelectField
            id="logbook-project"
            label="Project"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            hint="A machine can work a project that is not its deployed site's."
          >
            <option value="">Not recorded</option>
            {(projects.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </SelectField>
        </div>

        <TextField
          id="logbook-remarks"
          label="Remarks"
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
        />
      </form>
    </Modal>
  );
}
