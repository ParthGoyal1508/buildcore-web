'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import { createIndent } from '@/app/lib/api/inventory';
import { MESSAGES } from '@/app/lib/constants';
import {
  FormError,
  RowAction,
  SecondaryButton,
  SelectField,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useItems, useSites } from './use-inventory-refs';

interface DraftLine {
  key: number;
  itemId: string;
  requestedQuantity: string;
}

let nextKey = 1;
const emptyLine = (): DraftLine => ({
  key: nextKey++,
  itemId: '',
  requestedQuantity: '',
});

/**
 * Raise a material indent.
 *
 * The one thing this screen must not imply is that submitting or approving it
 * reserves anything (009 FR-021/FR-025). It says so in as many words, because the
 * alternative is a site planning around material that another store can still issue
 * out from under them.
 */
export default function IndentForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const sites = useSites();
  const items = useItems();

  const [siteId, setSiteId] = useState('');
  const [requiredByDate, setRequiredByDate] = useState('');
  const [justification, setJustification] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const itemsById = new Map((items.data ?? []).map((item) => [item.id, item]));

  // A retired item cannot be indented — the backend refuses it with a 400, and the
  // field says so rather than letting the whole form fail on submit (TA005).
  const retiredLine = lines.find((line) => {
    const item = itemsById.get(line.itemId);
    return item !== undefined && !item.active;
  });

  const save = useMutation({
    mutationFn: () =>
      createIndent({
        siteId,
        requiredByDate,
        justification: justification.trim(),
        lines: lines
          .filter((line) => line.itemId && Number(line.requestedQuantity) > 0)
          .map((line) => ({
            itemId: line.itemId,
            requestedQuantity: Number(line.requestedQuantity),
          })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : 'Could not raise this indent.',
      ),
  });

  const validLines = lines.filter(
    (line) => line.itemId && Number(line.requestedQuantity) > 0,
  );
  const ready =
    siteId &&
    requiredByDate &&
    justification.trim() &&
    validLines.length > 0 &&
    !retiredLine;

  return (
    <Modal
      title="Raise indent"
      onClose={onClose}
      wide
      footer={
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <SecondaryButton
            type="submit"
            form="indent-form"
            disabled={!ready || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Raise indent'}
          </SecondaryButton>
        </div>
      }
    >
      <form
        id="indent-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            id="indent-site"
            label="Store"
            value={siteId}
            onChange={(event) => setSiteId(event.target.value)}
          >
            <option value="">Select…</option>
            {(sites.data ?? []).map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </SelectField>

          <TextField
            id="indent-required-by"
            label="Required by"
            type="date"
            value={requiredByDate}
            onChange={(event) => setRequiredByDate(event.target.value)}
          />

          <div className="sm:col-span-2">
            <TextField
              id="indent-justification"
              label="Justification"
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              hint="What the material is for. An approver sees this and nothing else."
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-gray-700">Items</legend>
          {lines.map((line, index) => {
            const item = itemsById.get(line.itemId);
            return (
              <div key={line.key} className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
                <SelectField
                  id={`indent-item-${line.key}`}
                  label={index === 0 ? 'Item' : ''}
                  value={line.itemId}
                  error={
                    item && !item.active
                      ? 'This item is retired and cannot be indented.'
                      : undefined
                  }
                  onChange={(event) =>
                    setLines(
                      lines.map((l) =>
                        l.key === line.key
                          ? { ...l, itemId: event.target.value }
                          : l,
                      ),
                    )
                  }
                >
                  <option value="">Select…</option>
                  {(items.data ?? []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} ({option.unit})
                    </option>
                  ))}
                </SelectField>

                <TextField
                  id={`indent-qty-${line.key}`}
                  label={index === 0 ? 'Quantity' : ''}
                  type="number"
                  min={0}
                  step="any"
                  value={line.requestedQuantity}
                  onChange={(event) =>
                    setLines(
                      lines.map((l) =>
                        l.key === line.key
                          ? { ...l, requestedQuantity: event.target.value }
                          : l,
                      ),
                    )
                  }
                />

                <div className="flex items-end">
                  <RowAction
                    onClick={() =>
                      setLines(
                        lines.length === 1
                          ? [emptyLine()]
                          : lines.filter((l) => l.key !== line.key),
                      )
                    }
                  >
                    Remove
                  </RowAction>
                </div>
              </div>
            );
          })}

          <div>
            <SecondaryButton
              type="button"
              onClick={() => setLines([...lines, emptyLine()])}
            >
              Add another item
            </SecondaryButton>
          </div>
        </fieldset>

        <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {MESSAGES.approvalDoesNotReserve}
        </p>

        <FormError message={error} />
      </form>
    </Modal>
  );
}
