'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { useSelectedCompanyId } from '@/app/lib/api/company-selection';
import { createIndent } from '@/app/lib/api/inventory';
import { MESSAGES } from '@/app/lib/constants';
import { todayIso } from '@/app/lib/format';
import AsyncSelect, { type SearchableOption } from '@/app/ui/async-select';
import { Button } from '@/app/ui/button';
import {
  FormError,
  RowAction,
  SecondaryButton,
  TextField,
  fieldClass,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';
import { useToast } from '@/app/ui/toast';
import { searchItems, searchSites } from './inventory-search';

interface DraftLine {
  key: number;
  /** The chosen item; its `note` is the unit. */
  item: SearchableOption | null;
  requestedQuantity: string;
}

let nextKey = 1;
const emptyLine = (): DraftLine => ({
  key: nextKey++,
  item: null,
  requestedQuantity: '',
});

interface LineProblem {
  field: 'item' | 'quantity';
  message: string;
}

/** What is wrong with each line, by key — empty when every line can be sent. */
function lineProblems(lines: DraftLine[]): Map<number, LineProblem> {
  const problems = new Map<number, LineProblem>();
  const firstLineOf = new Map<string, number>();
  lines.forEach((line, index) => {
    const qty = Number(line.requestedQuantity);
    if (!line.item) {
      problems.set(line.key, {
        field: 'item',
        message: 'Choose an item, or remove this line.',
      });
    } else if (firstLineOf.has(line.item.id)) {
      problems.set(line.key, {
        field: 'item',
        message: `${line.item.label} is already on line ${firstLineOf.get(line.item.id)! + 1}; change that quantity instead.`,
      });
    } else if (line.requestedQuantity === '' || !(qty > 0)) {
      problems.set(line.key, {
        field: 'quantity',
        message: 'Enter a quantity above zero.',
      });
    }
    if (line.item && !firstLineOf.has(line.item.id)) {
      firstLineOf.set(line.item.id, index);
    }
  });
  return problems;
}

/**
 * Raise a material indent.
 *
 * The one thing this screen must not imply is that submitting or approving it
 * reserves anything (009 FR-021/FR-025). It says so in as many words, because the
 * alternative is a site planning around material that another store can still issue
 * out from under them.
 *
 * 036 M7 (2026-10-17):
 * - **Incomplete lines are flagged, not dropped.** A line with no item or no quantity used to be
 *   filtered out on submit, so an indent of five lines could arrive with three and nobody knew.
 *   Submit now stops and marks each line that needs attention.
 * - The same item twice is refused at the second line — one line per item is what the approver
 *   and the fulfilment both work from.
 * - Every line's picker and quantity carry an accessible name (lines 2 onward had none), the unit
 *   sits beside the quantity, and "Required by" cannot be in the past.
 * - The pickers search the server: the item list stopped at 200, so the 201st item could not be
 *   indented. Only active items are offered, so the old retired-item check (which could never
 *   fire on an active-only list) is gone.
 */
export default function IndentForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const companyId = useSelectedCompanyId();

  const [site, setSite] = useState<SearchableOption | null>(null);
  const [requiredByDate, setRequiredByDate] = useState('');
  const [justification, setJustification] = useState('');
  const [department, setDepartment] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [showProblems, setShowProblems] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problems = lineProblems(lines);
  const today = todayIso();
  const pastDate = Boolean(requiredByDate) && requiredByDate < today;

  const updateLine = (key: number, patch: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );

  const save = useMutation({
    mutationFn: () =>
      createIndent({
        siteId: site!.id,
        requiredByDate,
        justification: justification.trim(),
        ...(department.trim() ? { department: department.trim() } : {}),
        lines: lines.map((line) => ({
          itemId: line.item!.id,
          requestedQuantity: Number(line.requestedQuantity),
        })),
      }),
    onSuccess: (indent) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success(`Indent ${indent.indentNumber} raised`);
      onClose();
    },
    // Everything typed stays; the server's reason is shown.
    onError: (err) => setError(errorMessage(err, 'Could not raise this indent.')),
  });

  const submit = () => {
    setError(null);
    if (problems.size > 0) {
      setShowProblems(true);
      setError(
        `${problems.size} line${problems.size === 1 ? ' needs' : 's need'} attention before this indent can be raised.`,
      );
      return;
    }
    if (!site || !requiredByDate || pastDate || !justification.trim()) return;
    save.mutate();
  };

  const isDirty = Boolean(
    site ||
      requiredByDate ||
      justification ||
      department ||
      lines.some((line) => line.item || line.requestedQuantity),
  );

  return (
    <Modal
      title="Raise indent"
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
            form="indent-form"
            disabled={!site || !requiredByDate || pastDate || !justification.trim()}
            loading={save.isPending}
          >
            Raise indent
          </Button>
        </>
      }
    >
      <form
        id="indent-form"
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="indent-site" className="font-medium text-gray-700">
              Store <span className="text-red-600">*</span>
            </label>
            <AsyncSelect
              id="indent-site"
              value={site?.id ?? ''}
              onChange={(_, option) => setSite(option)}
              search={searchSites}
              cacheKey={['inventory', 'sites', 'search', companyId]}
              selectedOption={site}
              placeholder="Search stores"
            />
          </div>

          <TextField
            id="indent-required-by"
            label="Required by *"
            type="date"
            required
            min={today}
            value={requiredByDate}
            onChange={(event) => setRequiredByDate(event.target.value)}
            error={pastDate ? 'Required by cannot be in the past.' : undefined}
          />

          {/* Printed on the client's indent (2026-10-15); optional, since a small site has one. */}
          <TextField
            id="indent-department"
            label="Department"
            placeholder="e.g. Civil, MEP, Finishing"
            autoComplete="off"
            maxLength={80}
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          />

          <div className="sm:col-span-2">
            <TextField
              id="indent-justification"
              label="Justification *"
              required
              maxLength={1000}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              hint="What the material is for. An approver sees this and nothing else."
            />
          </div>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium text-gray-700">
            Items <span className="text-red-600">*</span>
          </legend>
          {/* Column headings once, on screens wide enough to have columns. */}
          <div
            aria-hidden="true"
            className="hidden gap-3 text-xs font-medium text-gray-500 sm:grid sm:grid-cols-[2fr_1fr_auto]"
          >
            <span>Item</span>
            <span>Quantity</span>
            <span className="w-[5.5rem]" />
          </div>
          {lines.map((line, index) => {
            const problem = showProblems ? problems.get(line.key) : undefined;
            const errorId = `indent-line-${line.key}-error`;
            return (
              <div
                key={line.key}
                className={clsx(
                  'flex flex-col gap-2 rounded-md',
                  problem && 'bg-red-50 p-2 ring-1 ring-red-200',
                )}
              >
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:gap-3">
                  <AsyncSelect
                    value={line.item?.id ?? ''}
                    onChange={(_, option) =>
                      updateLine(line.key, { item: option })
                    }
                    search={searchItems}
                    cacheKey={['inventory', 'items', 'search', companyId]}
                    selectedOption={line.item}
                    placeholder="Search items by name or code"
                    aria-label={`Item, line ${index + 1}`}
                    invalid={problem?.field === 'item'}
                    aria-describedby={problem ? errorId : undefined}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      aria-label={`Quantity, line ${index + 1}${line.item?.note ? ` (${line.item.note})` : ''}`}
                      aria-invalid={problem?.field === 'quantity' || undefined}
                      aria-describedby={problem ? errorId : undefined}
                      placeholder="Qty"
                      value={line.requestedQuantity}
                      onChange={(event) =>
                        updateLine(line.key, {
                          requestedQuantity: event.target.value,
                        })
                      }
                      className={clsx(
                        fieldClass,
                        'min-w-0',
                        problem?.field === 'quantity' && 'border-red-500',
                      )}
                    />
                    <span className="w-12 shrink-0 text-sm text-gray-600">
                      {line.item?.note ?? ''}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <RowAction
                      aria-label={`Remove line ${index + 1}`}
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
                {problem && (
                  <p id={errorId} role="alert" className="text-xs text-red-700">
                    Line {index + 1}: {problem.message}
                  </p>
                )}
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

        <p className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-900">
          {MESSAGES.approvalDoesNotReserve}
        </p>

        <FormError message={error} />
      </form>
    </Modal>
  );
}
