'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  consumeSparePart,
  getJobParts,
  reversePartConsumption,
  type MaintenanceJob,
  type SparePartMovement,
} from '@/app/lib/api/plant';
import { MESSAGES, plantLabel } from '@/app/lib/constants';
import { formatRupees } from '@/app/lib/utils';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import ResponsiveList, { type Column } from '@/app/ui/settings/responsive-list';
import { usePlantEquipment, usePlantSpareParts } from './use-plant-refs';

/**
 * The parts consumed on one maintenance job (006 US10).
 *
 * Three behaviours here are the point of the screen:
 *
 * - **Available stock is shown live and Save is disabled when the quantity exceeds
 *   it** (web FR-014). The backend refuses it anyway, but finding that out on submit
 *   after typing a quantity is a worse experience than being told while typing.
 * - **An incompatible part warns and never blocks** (web FR-015). The yard sometimes
 *   has to fit what it has, and a system that refuses simply gets worked around.
 * - **Add Part is disabled outright on a closed job, with the reason under it**
 *   (web FR-016), rather than failing on submit.
 */
export default function JobPartsPanel({ job }: { job: MaintenanceJob }) {
  const queryClient = useQueryClient();
  const parts = usePlantSpareParts();
  const equipment = usePlantEquipment();

  const [sparePartId, setSparePartId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const movements = useQuery({
    queryKey: ['plant', 'maintenance', job.id, 'parts'],
    queryFn: () => getJobParts(job.id),
  });

  const isClosed = job.status === 'closed';
  const selected = parts.data?.find((row) => row.id === sparePartId);
  const machine = equipment.data?.find((row) => row.id === job.equipmentId);

  const requested = quantity === '' ? 0 : Number(quantity);
  const exceedsStock =
    selected !== undefined && requested > selected.stockQuantity;

  // Read-only and computed (web FR-012). The rate is the part's weighted average
  // *now*, which is exactly what the consumption will be valued at and frozen onto
  // — so this is the real figure, not an estimate.
  const amount =
    selected !== undefined && requested > 0
      ? Math.round(requested * selected.avgRate * 100) / 100
      : null;

  // Empty means unrestricted — a part nobody has classified fits anything.
  const incompatible =
    selected !== undefined &&
    machine !== undefined &&
    selected.compatibleCategoryIds.length > 0 &&
    !selected.compatibleCategoryIds.includes(machine.categoryId);

  const consume = useMutation({
    mutationFn: () =>
      consumeSparePart(job.id, {
        sparePartId,
        quantity: requested,
      }),
    onSuccess: () => {
      setError(null);
      setSparePartId('');
      setQuantity('');
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : MESSAGES.plantSaveFailed),
  });

  const reverse = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      reversePartConsumption(id, reason),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['plant'] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reverse that consumption.',
      ),
  });

  const columns: Column<SparePartMovement>[] = [
    {
      key: 'part',
      header: 'Part',
      render: (row) => (
        <span className="flex flex-col">
          <span>
            {row.partNumber} · {row.partName}
          </span>
          {row.incompatiblePart && (
            <span className="text-xs text-orange-700">
              Not listed as compatible
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Movement',
      render: (row) => plantLabel(row.type),
    },
    { key: 'quantity', header: 'Qty', render: (row) => row.quantity },
    {
      key: 'rate',
      header: 'Rate then',
      hideOnCard: true,
      // "then", not "now": the rate is frozen at consumption and a later receipt
      // moves the average without moving this.
      render: (row) => formatRupees(row.rate),
    },
    {
      key: 'amount',
      header: 'Value',
      render: (row) =>
        row.type === 'reversal'
          ? `−${formatRupees(row.amount)}`
          : formatRupees(row.amount),
    },
    {
      key: 'date',
      header: 'Date',
      hideOnCard: true,
      render: (row) => row.movementDate.slice(0, 10),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-900">Parts consumed</h3>

      <div className="grid items-start gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <SelectField
          id="job-part"
          label="Spare part"
          value={sparePartId}
          disabled={isClosed}
          onChange={(event) => setSparePartId(event.target.value)}
          hint={
            selected
              ? `${selected.stockQuantity} ${selected.unitOfMeasure} in stock at ${formatRupees(selected.avgRate)}`
              : undefined
          }
        >
          <option value="">Select a part</option>
          {(parts.data ?? []).map((part) => (
            <option key={part.id} value={part.id}>
              {part.partNumber} · {part.name}
            </option>
          ))}
        </SelectField>

        <TextField
          id="job-part-quantity"
          label="Quantity"
          type="number"
          min={0}
          step="0.001"
          value={quantity}
          disabled={isClosed}
          onChange={(event) => setQuantity(event.target.value)}
          error={
            exceedsStock
              ? `Only ${selected?.stockQuantity} ${selected?.unitOfMeasure} in stock.`
              : undefined
          }
        />

        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Value
          </span>
          <p
            aria-live="polite"
            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
          >
            {amount === null ? '—' : formatRupees(amount)}
          </p>
        </div>

        <div className="pt-6">
          <SecondaryButton
            type="button"
            disabled={
              isClosed ||
              consume.isPending ||
              sparePartId === '' ||
              requested <= 0 ||
              exceedsStock
            }
            title={isClosed ? MESSAGES.plantClosedJobParts : undefined}
            onClick={() => {
              setError(null);
              consume.mutate();
            }}
          >
            {consume.isPending ? 'Adding…' : 'Add part'}
          </SecondaryButton>
        </div>
      </div>

      {isClosed && (
        <p className="text-xs text-gray-500">{MESSAGES.plantClosedJobParts}</p>
      )}

      {/* Warns, never blocks (web FR-015). Save stays enabled above. */}
      {incompatible && !isClosed && (
        <p
          role="status"
          className="rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-800"
        >
          {MESSAGES.plantIncompatiblePart}
        </p>
      )}

      <FormError message={error} />

      <ResponsiveList
        columns={columns}
        rows={movements.data ?? []}
        rowKey={(row) => row.id}
        isLoading={movements.isPending}
        emptyMessage={MESSAGES.plantPartsEmpty}
        actions={(row) =>
          row.type === 'consumption' && !row.reversed ? (
            <RowAction
              disabled={reverse.isPending}
              onClick={() => {
                const reason = window.prompt(MESSAGES.plantReversalReason);
                if (reason && reason.trim()) {
                  reverse.mutate({ id: row.id, reason: reason.trim() });
                }
              }}
            >
              Reverse
            </RowAction>
          ) : null
        }
      />
    </div>
  );
}
