'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { snoozeReminder, type Reminder } from '@/app/lib/api/dashboard';
import { MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import Modal from '@/app/ui/settings/modal';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';

/** Today as `YYYY-MM-DD`, for the date input's floor. */
function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Collects an until-date and a reason before suppressing a reminder (spec FR-029).
 *
 * Both fields are required, and the reason is required by the API too. It is not
 * bureaucracy: a snooze with no stated reason is indistinguishable from ignoring the
 * reminder, and this text is what the audit trail shows to whoever finds the
 * certificate expired next month.
 */
export default function SnoozeModal({
  reminder,
  onClose,
}: {
  reminder: Reminder;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [snoozeUntil, setSnoozeUntil] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => snoozeReminder(reminder.id, { snoozeUntil, reason }),
    onSuccess: async () => {
      // Both the list and the header count change, and they are separate queries.
      await queryClient.invalidateQueries({ queryKey: ['reminders'] });
      await queryClient.invalidateQueries({ queryKey: ['reminderCount'] });
      onClose();
    },
    onError: () => setError(MESSAGES.saveFailed),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError(MESSAGES.snoozeReasonRequired);
      return;
    }
    // Checked here as well as by the API, so the user is told before a round trip
    // rather than after one.
    if (!snoozeUntil || snoozeUntil < today()) {
      setError(MESSAGES.snoozeDatePast);
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal title="Snooze reminder" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">{reminder.subject}</p>

        <TextField
          id="snoozeUntil"
          label="Snooze until"
          type="date"
          value={snoozeUntil}
          min={today()}
          onChange={(event) => setSnoozeUntil(event.target.value)}
          required
          // The one thing a user is most likely to get wrong about a snooze: it is a
          // delay, not a dismissal, and it ends on its date whether or not the
          // reminder has grown more urgent meanwhile.
          hint="The reminder returns on this date even if it has become overdue by then."
        />

        <TextField
          id="reason"
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Renewal already lodged, receipt pending"
          required
        />

        <FormError message={error} />

        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Snoozing…' : 'Snooze'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
