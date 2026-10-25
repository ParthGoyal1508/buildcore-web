'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  createLogbookEntry,
  getLogbook,
  type Equipment,
} from '@/app/lib/api/plant';
import { MESSAGES } from '@/app/lib/constants';
import { todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';
import {
  EmployeePicker,
  EquipmentPicker,
  ProjectPicker,
  readingWithUnit,
} from './pickers';

/** The day before an ISO date, as an ISO date. */
function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Record a day in the logbook.
 *
 * Total Hours is computed live and rendered read-only (web FR-002): it is
 * `closing − opening` and always will be, so an editable field could only ever
 * disagree with the two numbers above it. The same rule the backend applies when it
 * stores the value.
 *
 * 036 K15: the machine and operator are server-searched pickers, the opening reading is
 * prefilled only while empty (choosing a machine used to overwrite what had been typed), the
 * date cannot be in the future, and readings show their unit. K4/K6: when the opening reading
 * does not follow the previous entry's closing one, a reason is asked for — the API refuses
 * the gap without one.
 */
export default function LogbookModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [machine, setMachine] = useState<Equipment | null>(null);
  const [date, setDate] = useState(todayIso());
  const [openingReading, setOpeningReading] = useState('');
  const [closingReading, setClosingReading] = useState('');
  const [fuelConsumed, setFuelConsumed] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [gapReason, setGapReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const equipmentId = machine?.id ?? '';
  const meterType = machine?.meterType ?? 'hours';
  const unit = meterType === 'km' ? 'km' : 'h';

  // The entry this day follows on from: the latest one before it. Its closing reading is what
  // the opening reading should be, and the server compares against exactly this entry.
  const previous = useQuery({
    queryKey: ['plant', 'logbook', 'previous', equipmentId, date],
    queryFn: () =>
      getLogbook({
        equipmentId,
        dateTo: dayBefore(date),
        pageSize: 1,
      }),
    enabled: Boolean(equipmentId && date),
    select: (page) => page.items[0] ?? null,
  });
  const previousClosing = previous.data?.closingReading ?? null;

  const opening = Number(openingReading);
  const closing = Number(closingReading);
  const bothEntered = openingReading !== '' && closingReading !== '';
  const totalHours = bothEntered ? closing - opening : null;
  // Equal readings are legitimate — a machine that stood idle all day still gets an
  // entry, with zero hours. Only a *negative* span is refused.
  const readingsInvalid = bothEntered && closing < opening;
  const tooManyHours =
    bothEntered && meterType === 'hours' && closing - opening > 24;
  const hasGap =
    previousClosing !== null &&
    openingReading !== '' &&
    Math.round(opening * 1000) !== Math.round(previousClosing * 1000);

  const isDirty = Boolean(
    machine ||
      openingReading ||
      closingReading ||
      fuelConsumed ||
      operatorId ||
      projectId ||
      remarks,
  );

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
        ...(hasGap && gapReason.trim()
          ? { readingGapReason: gapReason.trim() }
          : {}),
      }),
    onSuccess: (entry) => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      toast.success(
        `Recorded ${entry.equipmentCode} for ${entry.date
          .slice(0, 10)
          .split('-')
          .reverse()
          .join('-')}.`,
      );
      onClose();
    },
    // The form keeps everything typed: only the message changes.
    onError: (err) => setError(errorMessage(err, MESSAGES.plantSaveFailed)),
  });

  return (
    <Modal
      title="Record a day"
      onClose={onClose}
      wide
      isDirty={isDirty}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="logbook-form"
            loading={save.isPending}
            disabled={
              !equipmentId ||
              readingsInvalid ||
              tooManyHours ||
              (hasGap && !gapReason.trim())
            }
          >
            Save
          </Button>
        </>
      }
    >
      <form
        id="logbook-form"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <FormError message={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <EquipmentPicker
            id="logbook-equipment"
            label="Machine"
            required
            value={equipmentId}
            onChange={(_, row) => {
              setMachine(row);
              // Prefilled from the machine's meter only while the field is empty — never over a
              // reading the operator already typed (036 K15). The previous entry's closing reading,
              // once it loads, is offered below as the expected figure.
              if (row && openingReading === '') {
                setOpeningReading(String(row.currentReading));
              }
            }}
            hint={
              machine
                ? `Meter now ${readingWithUnit(machine.currentReading, meterType)}`
                : undefined
            }
          />

          <TextField
            id="logbook-date"
            label="Date"
            type="date"
            required
            max={todayIso()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            hint="One entry per machine per day; not in the future."
          />

          <TextField
            id="logbook-opening"
            label={`Opening reading (${unit})`}
            type="number"
            inputMode="decimal"
            required
            min={0}
            step="0.001"
            value={openingReading}
            onChange={(event) => setOpeningReading(event.target.value)}
            hint={
              previousClosing !== null
                ? `Previous closing: ${readingWithUnit(previousClosing, meterType)}`
                : undefined
            }
          />

          <TextField
            id="logbook-closing"
            label={`Closing reading (${unit})`}
            type="number"
            inputMode="decimal"
            required
            min={0}
            step="0.001"
            value={closingReading}
            onChange={(event) => setClosingReading(event.target.value)}
            error={
              readingsInvalid
                ? 'A meter does not run backwards — the closing reading cannot be lower.'
                : tooManyHours
                  ? 'More than 24 hours in one day. Check the readings.'
                  : undefined
            }
          />

          {hasGap && (
            <div className="sm:col-span-2">
              <TextField
                id="logbook-gap-reason"
                label="Reason for the reading gap"
                required
                maxLength={500}
                value={gapReason}
                onChange={(event) => setGapReason(event.target.value)}
                hint={`The opening reading does not follow the previous closing reading (${readingWithUnit(
                  previousClosing,
                  meterType,
                )}). Correct it, or say why — meter replaced, moved on a trailer.`}
              />
            </div>
          )}

          {/* Read-only and computed (web FR-002): an editable Total Hours could
              only ever disagree with the two readings above it. */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              {meterType === 'km' ? 'Distance run' : 'Total hours'}
            </span>
            <p
              aria-live="polite"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            >
              {totalHours === null || readingsInvalid
                ? '—'
                : readingWithUnit(totalHours, meterType)}
            </p>
          </div>

          <TextField
            id="logbook-fuel"
            label="Fuel consumed (litres)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.001"
            value={fuelConsumed}
            onChange={(event) => setFuelConsumed(event.target.value)}
            hint="What the operator recorded. Fuel variance is measured against this."
          />

          <EmployeePicker
            id="logbook-operator"
            label="Operator"
            emptyLabel="Not recorded"
            value={operatorId}
            // Scoped to the machine's deployed site (042): `/hr/employees` has filtered on
            // `siteId` since 005, so the picker offers the people who are actually there rather
            // than the whole company. A machine deployed nowhere searches everyone, as before.
            siteId={machine?.deployedSiteId ?? undefined}
            hint={
              machine?.deployedSiteId
                ? `Employees at ${machine.siteName ?? 'the machine’s site'}.`
                : undefined
            }
            onChange={(id) => setOperatorId(id)}
          />

          <ProjectPicker
            id="logbook-project"
            label="Project"
            emptyLabel="Not recorded"
            value={projectId}
            onChange={(id) => setProjectId(id)}
            hint="A machine can work a project that is not its deployed site's."
          />
        </div>

        <TextField
          id="logbook-remarks"
          label="Remarks"
          maxLength={500}
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
        />
      </form>
    </Modal>
  );
}
