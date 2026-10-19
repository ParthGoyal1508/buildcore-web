'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createServiceSchedule,
  getEquipmentDetail,
  updateServiceSchedule,
  type Equipment,
  type ServiceSchedule,
} from '@/app/lib/api/plant';
import { MESSAGES, formatReading } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import { EquipmentPicker, equipmentOption } from './pickers';

/**
 * Add or edit a service schedule.
 *
 * Next Due is previewed read-only: it is `lastDone + interval` and the backend
 * recomputes it on every write rather than accepting one, so an editable field would
 * be a number the server ignores.
 *
 * The interval field follows the machine's meter — hours for an hours-metered
 * machine, kilometres for a km-metered one. Offering both at once would let someone
 * set a crane's service in kilometres.
 */
export default function ServiceScheduleModal({
  schedule,
  onClose,
}: {
  schedule?: ServiceSchedule;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = schedule !== undefined;

  const [machine, setMachine] = useState<Equipment | null>(null);
  const [equipmentId, setEquipmentId] = useState(schedule?.equipmentId ?? '');
  // An edit names its machine from the record; a new schedule from the picker's row.
  const existing = useQuery({
    queryKey: ['plant', 'equipment', schedule?.equipmentId ?? ''],
    queryFn: () => getEquipmentDetail(schedule!.equipmentId),
    enabled: isEdit,
  });
  const [serviceType, setServiceType] = useState(schedule?.serviceType ?? '');
  const [interval, setInterval] = useState(
    String(schedule?.intervalHours ?? schedule?.intervalKm ?? ''),
  );
  const [lastDoneReading, setLastDoneReading] = useState(
    String(schedule?.lastDoneReading ?? ''),
  );
  const [error, setError] = useState<string | null>(null);

  const meterType = (machine ?? existing.data)?.meterType ?? 'hours';
  const nextDue =
    interval !== '' && lastDoneReading !== ''
      ? Number(lastDoneReading) + Number(interval)
      : null;

  const save = useMutation({
    mutationFn: () => {
      const body = {
        equipmentId,
        serviceType: serviceType.trim(),
        lastDoneReading: Number(lastDoneReading),
        ...(meterType === 'km'
          ? { intervalKm: Number(interval) }
          : { intervalHours: Number(interval) }),
      };
      return isEdit
        ? updateServiceSchedule(schedule.id, body)
        : createServiceSchedule(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
  });

  return (
    <Modal
      title={isEdit ? 'Edit schedule' : 'Add a service schedule'}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" form="schedule-form" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id="schedule-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />

        <EquipmentPicker
          id="schedule-equipment"
          label="Machine"
          required
          disabled={isEdit}
          value={equipmentId}
          selectedOption={existing.data ? equipmentOption(existing.data) : null}
          onChange={(id, row) => {
            setEquipmentId(id);
            setMachine(row);
          }}
          hint={
            isEdit
              ? 'A schedule belongs to the machine it was created for.'
              : undefined
          }
        />

        <TextField
          id="schedule-type"
          label="Service"
          required
          placeholder="Engine oil and filter"
          value={serviceType}
          onChange={(event) => setServiceType(event.target.value)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="schedule-interval"
            label={meterType === 'km' ? 'Interval (km)' : 'Interval (hours)'}
            type="number"
            required
            min={1}
            step="0.001"
            value={interval}
            onChange={(event) => setInterval(event.target.value)}
          />
          <TextField
            id="schedule-last-done"
            label="Last done at"
            type="number"
            required
            min={0}
            step="0.001"
            value={lastDoneReading}
            onChange={(event) => setLastDoneReading(event.target.value)}
          />
        </div>

        {/* Read-only: the backend recomputes this on every write rather than
            accepting one, so an editable field would be ignored. */}
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Next due at
          </span>
          <p
            aria-live="polite"
            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
          >
            {nextDue === null ? '—' : formatReading(nextDue, meterType)}
          </p>
        </div>
      </form>
    </Modal>
  );
}
