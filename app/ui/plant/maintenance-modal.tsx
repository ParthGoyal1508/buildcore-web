'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  closeMaintenanceJob,
  createMaintenanceJob,
  getServiceSchedules,
  type MaintenanceJob,
} from '@/app/lib/api/plant';
import { MAINTENANCE_TYPES, MESSAGES, plantLabel } from '@/app/lib/constants';
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
 * Open a maintenance job.
 *
 * Machines already under maintenance are excluded from the picker, because the
 * backend refuses a second open job on one (006 FR-002) and offering it would be a
 * choice that always fails. The linked-schedule picker is filtered to the chosen
 * machine's own schedules for the same reason.
 */
export function OpenJobModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const equipment = usePlantEquipment();

  const [equipmentId, setEquipmentId] = useState('');
  const [type, setType] = useState<string>('breakdown');
  const [description, setDescription] = useState('');
  const [linkedServiceScheduleId, setLinkedServiceScheduleId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const schedules = useQuery({
    queryKey: ['plant', 'services', { equipmentId }],
    queryFn: () => getServiceSchedules({ equipmentId, pageSize: 100 }),
    select: (page) => page.items,
    enabled: equipmentId !== '',
  });

  const available = (equipment.data ?? []).filter(
    (row) => row.status !== 'under_maintenance',
  );

  const save = useMutation({
    mutationFn: () =>
      createMaintenanceJob({
        equipmentId,
        type,
        description: description.trim(),
        ...(linkedServiceScheduleId ? { linkedServiceScheduleId } : {}),
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
      title="Open a maintenance job"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="job-form" disabled={save.isPending}>
            {save.isPending ? 'Opening…' : 'Open job'}
          </Button>
        </>
      }
    >
      <form
        id="job-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />

        <SelectField
          id="job-equipment"
          label="Machine"
          required
          value={equipmentId}
          onChange={(event) => {
            setEquipmentId(event.target.value);
            // Clearing here rather than in an effect: a schedule belonging to the
            // previous machine would be rejected on save.
            setLinkedServiceScheduleId('');
          }}
          hint="Opening a job puts this machine under maintenance until the job is closed."
        >
          <option value="">Select a machine</option>
          {available.map((row) => (
            <option key={row.id} value={row.id}>
              {row.code} · {row.name}
            </option>
          ))}
        </SelectField>

        <SelectField
          id="job-type"
          label="Type"
          required
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {MAINTENANCE_TYPES.map((value) => (
            <option key={value} value={value}>
              {plantLabel(value)}
            </option>
          ))}
        </SelectField>

        <TextField
          id="job-description"
          label="What is wrong"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <SelectField
          id="job-schedule"
          label="Discharges service schedule"
          value={linkedServiceScheduleId}
          disabled={equipmentId === ''}
          onChange={(event) => setLinkedServiceScheduleId(event.target.value)}
          hint="Linking moves the schedule forward when this job is closed."
        >
          <option value="">Not a scheduled service</option>
          {(schedules.data ?? []).map((schedule) => (
            <option key={schedule.id} value={schedule.id}>
              {schedule.serviceType} — due at {schedule.nextDueReading}
            </option>
          ))}
        </SelectField>
      </form>
    </Modal>
  );
}

/**
 * Close a maintenance job.
 *
 * The closing reading is required because it does two things: it returns the machine
 * to service at the meter it actually stands on, and it re-dates any linked service
 * schedule forward. Closing without it would leave a scheduled service permanently
 * overdue.
 */
export function CloseJobModal({
  job,
  onClose,
}: {
  job: MaintenanceJob;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [closingReading, setClosingReading] = useState('');
  const [labourCost, setLabourCost] = useState(
    job.labourCost === null ? '' : String(job.labourCost),
  );
  const [partsDescription, setPartsDescription] = useState(
    job.partsDescription ?? '',
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      closeMaintenanceJob(job.id, {
        closingReading: Number(closingReading),
        ...(labourCost ? { labourCost: Number(labourCost) } : {}),
        ...(partsDescription.trim()
          ? { partsDescription: partsDescription.trim() }
          : {}),
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
      title={`Close job — ${job.equipmentCode}`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="close-job-form" disabled={save.isPending}>
            {save.isPending ? 'Closing…' : 'Close job'}
          </Button>
        </>
      }
    >
      <form
        id="close-job-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />

        <TextField
          id="close-reading"
          label="Closing meter reading"
          type="number"
          required
          min={0}
          step="0.001"
          value={closingReading}
          onChange={(event) => setClosingReading(event.target.value)}
          hint="Where the meter stands now. Only ever taken forward — a lower reading is left alone."
        />

        <TextField
          id="close-labour"
          label="Internal labour (₹)"
          type="number"
          min={0}
          step="0.01"
          value={labourCost}
          onChange={(event) => setLabourCost(event.target.value)}
          hint="The workshop's own hours. Parts cost accrues separately from what was consumed."
        />

        <TextField
          id="close-parts-description"
          label="Work done"
          value={partsDescription}
          onChange={(event) => setPartsDescription(event.target.value)}
        />
      </form>
    </Modal>
  );
}
