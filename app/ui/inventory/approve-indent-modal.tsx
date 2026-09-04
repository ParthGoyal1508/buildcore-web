'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { approveIndent, type Indent } from '@/app/lib/api/inventory';
import { MESSAGES } from '@/app/lib/constants';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';

/**
 * Approve an indent, line by line.
 *
 * A line may be approved for less than was asked, and when it is, a reason is
 * required — the backend refuses the write without one (009 FR-022), and the form
 * refuses to submit for the same reason rather than discovering it in a 400. Both
 * figures stay on screen afterwards: the requested quantity is what makes the
 * reduction legible as a decision.
 */
export default function ApproveIndentModal({
  indent,
  onClose,
}: {
  indent: Indent;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [decisions, setDecisions] = useState(
    indent.lines.map((line) => ({
      lineId: line.id,
      approvedQuantity: String(line.requestedQuantity),
      reductionReason: '',
    })),
  );
  const [error, setError] = useState<string | null>(null);

  const requestedFor = (lineId: string) =>
    indent.lines.find((line) => line.id === lineId)?.requestedQuantity ?? 0;

  const missingReason = decisions.some(
    (decision) =>
      Number(decision.approvedQuantity) < requestedFor(decision.lineId) &&
      !decision.reductionReason.trim(),
  );
  const overApproved = decisions.some(
    (decision) =>
      Number(decision.approvedQuantity) > requestedFor(decision.lineId),
  );

  const save = useMutation({
    mutationFn: () =>
      approveIndent(indent.id, {
        lines: decisions.map((decision) => ({
          lineId: decision.lineId,
          approvedQuantity: Number(decision.approvedQuantity),
          ...(decision.reductionReason.trim()
            ? { reductionReason: decision.reductionReason.trim() }
            : {}),
        })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not approve this indent.',
      ),
  });

  return (
    <Modal
      title={`Approve ${indent.indentNumber}`}
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <SecondaryButton
            type="submit"
            form="approve-form"
            disabled={missingReason || overApproved || save.isPending}
          >
            {save.isPending ? 'Approving…' : 'Approve'}
          </SecondaryButton>
        </div>
      }
    >
      <form
        id="approve-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <p className="text-sm text-gray-600">{indent.justification}</p>

        {indent.lines.map((line, index) => {
          const decision = decisions[index];
          const reduced = Number(decision.approvedQuantity) < line.requestedQuantity;
          const over = Number(decision.approvedQuantity) > line.requestedQuantity;
          return (
            <div
              key={line.id}
              className="grid gap-3 rounded-md border border-gray-200 p-3 sm:grid-cols-2"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {line.itemName}
                </p>
                <p className="text-xs text-gray-500">
                  Requested {line.requestedQuantity} {line.unit}
                </p>
              </div>

              <TextField
                id={`approve-qty-${line.id}`}
                label="Approve"
                type="number"
                min={0}
                step="any"
                value={decision.approvedQuantity}
                error={
                  over
                    ? `Cannot approve more than the ${line.requestedQuantity} requested.`
                    : undefined
                }
                onChange={(event) =>
                  setDecisions(
                    decisions.map((d, i) =>
                      i === index
                        ? { ...d, approvedQuantity: event.target.value }
                        : d,
                    ),
                  )
                }
              />

              {reduced && (
                <div className="sm:col-span-2">
                  <TextField
                    id={`approve-reason-${line.id}`}
                    label="Reason for the reduction"
                    value={decision.reductionReason}
                    error={
                      decision.reductionReason.trim()
                        ? undefined
                        : MESSAGES.reductionNeedsReason
                    }
                    onChange={(event) =>
                      setDecisions(
                        decisions.map((d, i) =>
                          i === index
                            ? { ...d, reductionReason: event.target.value }
                            : d,
                        ),
                      )
                    }
                  />
                </div>
              )}
            </div>
          );
        })}

        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {MESSAGES.approvalDoesNotReserve}
        </p>

        <FormError message={error} />
      </form>
    </Modal>
  );
}
