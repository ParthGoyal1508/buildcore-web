'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  EDITABLE_LINE_FIELDS,
  editPayrollLine,
  getPayrollLineEdits,
  lineFieldLabel,
  type EditableLineField,
  type PayrollLineEdit,
  type PayrollLineItem,
} from '@/app/lib/api/hr-payroll';
import { dateTimeLabel, money, rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import Modal from '@/app/ui/settings/modal';
import { FormError, SecondaryButton, TextField } from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';

/**
 * Hand corrections to a generated payroll (039): the edit form, one line's change history, and the
 * run's list of every change.
 *
 * The justification is mandatory and kept against each figure changed, so the history answers "why
 * did this basic change?" figure by figure. Net pay is never typed — the server recomputes it from
 * the figures, the same way generation forms it.
 */

const lineName = (line: PayrollLineItem) =>
  line.name ?? line.employeeCode ?? line.employeeId;

const editsKey = (runId: string, lineItemId?: string) =>
  ['hr', 'payrollRunEdits', runId, lineItemId ?? 'all'] as const;

export function EditLineModal({
  runId,
  line,
  onClose,
}: {
  runId: string;
  line: PayrollLineItem;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const initial = Object.fromEntries(
    EDITABLE_LINE_FIELDS.map(({ field }) => [field, String(line[field])]),
  ) as Record<EditableLineField, string>;
  const [values, setValues] = useState(initial);
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);

  const changes = Object.fromEntries(
    EDITABLE_LINE_FIELDS.flatMap(({ field }) => {
      const next = Number(values[field]);
      return values[field].trim() !== '' && next !== line[field] ? [[field, next]] : [];
    }),
  ) as Partial<Record<EditableLineField, number>>;
  const changedCount = Object.keys(changes).length;
  const invalid = EDITABLE_LINE_FIELDS.find(({ field }) => {
    const v = values[field].trim();
    return v === '' || !/^\d+(\.\d{1,2})?$/.test(v);
  });
  const dirty = changedCount > 0 || justification.trim() !== '';

  const save = useMutation({
    mutationFn: () => editPayrollLine(runId, line.id ?? '', changes, justification.trim()),
    onSuccess: (updated) => {
      toast.success(
        `${lineName(line)} corrected — net pay ${rupees(line.netPay)} → ${rupees(updated.netPay)}.`,
      );
      void queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRun', runId] });
      void queryClient.invalidateQueries({ queryKey: ['hr', 'payrollRunEdits', runId] });
      onClose();
    },
    onError: (err: Error) => setError(errorMessage(err, 'Could not save the correction.')),
  });

  return (
    <Modal
      title={`Correct ${lineName(line)}`}
      onClose={onClose}
      isDirty={dirty}
      pending={save.isPending}
      wide
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose} disabled={save.isPending}>
            Cancel
          </SecondaryButton>
          <Button
            type="submit"
            form="payroll-line-edit"
            loading={save.isPending}
            disabled={changedCount === 0 || !justification.trim() || Boolean(invalid)}
          >
            Save correction
          </Button>
        </>
      }
    >
      <form
        id="payroll-line-edit"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          save.mutate();
        }}
        className="space-y-4"
      >
        <p className="text-sm text-gray-600">
          Change only the figures that are wrong. Net pay is recalculated from them (now{' '}
          {rupees(line.netPay)}). Other heads are not recalculated — if a change to basic should
          change PF, correct PF too. Loan EMI, advance and fuel recoveries are corrected on the
          loan, advance or recovery itself, then the run regenerated.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EDITABLE_LINE_FIELDS.map(({ field, label }) => {
            const changed = field in changes;
            return (
              <TextField
                key={field}
                id={`edit-${field}`}
                label={label}
                inputMode="decimal"
                value={values[field]}
                onChange={(event) =>
                  setValues((v) => ({ ...v, [field]: event.target.value }))
                }
                error={invalid?.field === field ? 'A rupee amount, up to two decimals.' : undefined}
                hint={changed ? `Was ${money(line[field])}` : undefined}
              />
            );
          })}
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">
            Justification <span className="text-red-700">*</span>
          </span>
          <textarea
            value={justification}
            rows={3}
            maxLength={1000}
            required
            onChange={(event) => setJustification(event.target.value)}
            placeholder="Why these figures are being changed — kept in the run's change history."
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </label>
        <FormError message={error} />
      </form>
    </Modal>
  );
}

/** One change, as a sentence: "Basic 20,000.00 → 21,000.00". */
function ChangeText({ edit }: { edit: PayrollLineEdit }) {
  return (
    <>
      <span className="font-medium text-gray-900">{lineFieldLabel(edit.field)}</span>{' '}
      <span className="tabular-nums">
        {money(edit.oldValue)} → {money(edit.newValue)}
      </span>
    </>
  );
}

/** Every correction to one line, newest first — who, which figure, old → new, why and when. */
export function LineHistoryModal({
  runId,
  line,
  onClose,
}: {
  runId: string;
  line: PayrollLineItem;
  onClose: () => void;
}) {
  const lineId = line.id ?? '';
  const edits = useQuery({
    queryKey: editsKey(runId, lineId),
    queryFn: () => getPayrollLineEdits(runId, lineId),
  });
  return (
    <Modal title={`Changes to ${lineName(line)}`} onClose={onClose} closeOnBackdrop>
      {edits.isPending && <p className="text-sm text-gray-500">Loading…</p>}
      {edits.isError && <FormError message={errorMessage(edits.error)} />}
      {edits.data && edits.data.length === 0 && (
        <p className="text-sm text-gray-500">This line has not been changed by hand.</p>
      )}
      {edits.data && edits.data.length > 0 && (
        <ol className="space-y-3 border-l border-gray-200 pl-3 text-sm">
          {edits.data.map((edit) => (
            <li key={edit.id}>
              <ChangeText edit={edit} />
              <p className="text-xs text-gray-600">
                {edit.editedByName ?? 'Unknown user'} · {dateTimeLabel(edit.createdAt)}
              </p>
              <p className="mt-0.5 text-gray-700">“{edit.justification}”</p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

/** The run's whole change history (039), for whoever checks the run before it goes to the Director. */
export function RunEditsTable({ runId }: { runId: string }) {
  const edits = useQuery({
    queryKey: editsKey(runId),
    queryFn: () => getPayrollLineEdits(runId),
  });
  const columns: Column<PayrollLineEdit>[] = [
    {
      key: 'when',
      header: 'When',
      sticky: true,
      render: (e) => dateTimeLabel(e.createdAt),
      sortValue: (e) => e.createdAt,
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (e) =>
        [e.employeeName, e.employeeCode ? `(${e.employeeCode})` : null]
          .filter(Boolean)
          .join(' ') || e.employeeId,
      sortValue: (e) => e.employeeName ?? e.employeeCode ?? '',
    },
    {
      key: 'field',
      header: 'Figure',
      render: (e) => lineFieldLabel(e.field),
      sortValue: (e) => lineFieldLabel(e.field),
    },
    {
      key: 'old',
      header: 'Was',
      numeric: true,
      render: (e) => money(e.oldValue),
      sortValue: (e) => e.oldValue,
    },
    {
      key: 'new',
      header: 'Now',
      numeric: true,
      render: (e) => money(e.newValue),
      sortValue: (e) => e.newValue,
    },
    {
      key: 'why',
      header: 'Justification',
      render: (e) => <span className="whitespace-normal">{e.justification}</span>,
      sortable: false,
    },
    {
      key: 'by',
      header: 'Changed by',
      render: (e) => e.editedByName ?? '—',
      sortValue: (e) => e.editedByName ?? '',
    },
  ];
  return (
    <DataTable
      caption="Changes made to this run by hand"
      columns={columns}
      rows={edits.data ?? []}
      rowKey={(e) => e.id}
      isLoading={edits.isPending}
      error={edits.isError ? edits.error : undefined}
      onRetry={() => edits.refetch()}
      emptyMessage="Nothing in this run has been changed by hand."
    />
  );
}
