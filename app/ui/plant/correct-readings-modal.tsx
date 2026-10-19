'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  correctLogbookReadings,
  type LogbookEntry,
} from '@/app/lib/api/plant';
import { dateLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';
import { readingWithUnit } from './pickers';

/**
 * Correct a day's readings (036 K6).
 *
 * The monthly sheet says to correct a read day "from the Logbook", and the Logbook offered only
 * Delete — which also lost the operator, project and remarks, and left no record of the old
 * figures. This changes the two readings in place; the reason is required and kept in the audit
 * log with the readings before and after. Refused (409) inside a verified or paid hire bill.
 */
export default function CorrectReadingsModal({
  entry,
  meterType,
  onClose,
}: {
  entry: LogbookEntry;
  /** `hours` or `km`, for the units. Unknown on the list row; defaults to hours. */
  meterType?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [opening, setOpening] = useState(String(entry.openingReading));
  const [closing, setClosing] = useState(String(entry.closingReading));
  const [reason, setReason] = useState('');
  const [gapReason, setGapReason] = useState(entry.readingGapReason ?? '');
  const [error, setError] = useState<string | null>(null);
  const [needsGapReason, setNeedsGapReason] = useState(
    Boolean(entry.readingGapReason),
  );

  const unit = meterType === 'km' ? 'km' : 'h';
  const openingValue = Number(opening);
  const closingValue = Number(closing);
  const backwards = opening !== '' && closing !== '' && closingValue < openingValue;
  const changed =
    openingValue !== entry.openingReading ||
    closingValue !== entry.closingReading;
  const isDirty = changed || reason.trim() !== '';

  const save = useMutation({
    mutationFn: () =>
      correctLogbookReadings(entry.id, {
        openingReading: openingValue,
        closingReading: closingValue,
        reason: reason.trim(),
        ...(gapReason.trim() ? { readingGapReason: gapReason.trim() } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
      toast.success(
        `Readings for ${entry.equipmentCode} on ${dateLabel(entry.date)} corrected.`,
      );
      onClose();
    },
    onError: (err) => {
      const message = errorMessage(err, 'The readings could not be corrected.');
      // The API names the gap; the field to explain it appears instead of a dead end.
      if (/does not follow on/i.test(message)) setNeedsGapReason(true);
      setError(message);
    },
  });

  return (
    <Modal
      title={`Correct readings · ${entry.equipmentCode} · ${dateLabel(entry.date)}`}
      onClose={onClose}
      isDirty={isDirty}
      pending={save.isPending}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="correct-readings-form"
            loading={save.isPending}
            disabled={!changed || backwards || !reason.trim()}
          >
            Save correction
          </Button>
        </>
      }
    >
      <form
        id="correct-readings-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <FormError message={error} />
        <p className="text-sm text-gray-600">
          Recorded as {readingWithUnit(entry.openingReading, meterType)} to{' '}
          {readingWithUnit(entry.closingReading, meterType)}. The machine&apos;s
          meter and utilisation are recalculated. Check the next day&apos;s
          opening reading afterwards.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="correct-opening"
            label={`Opening reading (${unit})`}
            type="number"
            inputMode="decimal"
            required
            min={0}
            step="0.001"
            value={opening}
            onChange={(event) => setOpening(event.target.value)}
          />
          <TextField
            id="correct-closing"
            label={`Closing reading (${unit})`}
            type="number"
            inputMode="decimal"
            required
            min={0}
            step="0.001"
            value={closing}
            onChange={(event) => setClosing(event.target.value)}
            error={
              backwards
                ? 'The closing reading cannot be lower than the opening one.'
                : undefined
            }
          />
        </div>
        <TextField
          id="correct-reason"
          label="Reason for the correction"
          required
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          hint="Kept in the audit log with the old and new readings."
        />
        {needsGapReason && (
          <TextField
            id="correct-gap-reason"
            label="Reason for the reading gap"
            maxLength={500}
            value={gapReason}
            onChange={(event) => setGapReason(event.target.value)}
            hint="Needed when the opening reading does not follow the previous day's closing reading."
          />
        )}
      </form>
    </Modal>
  );
}
