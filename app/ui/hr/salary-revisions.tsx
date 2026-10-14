'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  createSalaryRevision,
  listSalaryRevisions,
  type Employee,
  type SalaryRevision,
  type SalaryRevisionInput,
} from '@/app/lib/api/hr-payroll';
import { getCurrentUser, hasWrite } from '@/app/lib/api/users';
import { dateLabel, money, todayIso } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import GenerateLetterDialog, {
  useOfferableLetterKinds,
} from '@/app/ui/letters/generate-letter-dialog';
import {
  FormError,
  SecondaryButton,
  TextField,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';

/** The five pay heads, as the revision endpoint names them and as the employee row does. */
const HEADS = [
  { key: 'basic', label: 'Basic', current: 'basic' },
  { key: 'hra', label: 'HRA', current: 'hra' },
  { key: 'conveyance', label: 'Conveyance', current: 'conveyanceAllowance' },
  { key: 'siteAllowance', label: 'Site allowance', current: 'siteAllowance' },
  { key: 'specialAllowance', label: 'Special allowance', current: 'specialAllowance' },
] as const satisfies readonly {
  key: keyof SalaryRevisionInput;
  label: string;
  current: keyof Employee;
}[];

type HeadKey = (typeof HEADS)[number]['key'];

/** The refusals this endpoint names, in words that say what to do instead. */
const REVISION_REFUSALS: Record<string, string> = {
  SALARY_REVISION_FUTURE_DATE:
    'The effective date is in the future. A revision is applied to pay straight away, so record it on or after the day it takes effect.',
  SALARY_REVISION_BEFORE_LATEST:
    'The effective date is before this employee’s latest revision. Revisions are recorded in order.',
  SALARY_REVISION_NO_CHANGE:
    'None of the pay heads changed. Change at least one figure to record a revision.',
};

const INCREMENT_KIND = ['increment'] as const;

/**
 * An employee's salary revision history and the form that records the next one (HR documents,
 * 2026-10-13).
 *
 * `PAYROLL`, as the api requires: the history shows what somebody was paid before. A caller
 * without it sees nothing here rather than an error, because the structure above already shows
 * the current pay to anybody who may read the employee.
 *
 * Recording a revision **changes the pay immediately** — the api writes the new heads onto the
 * employee, which is what payroll reads — so the form says so, and the employee is refetched after.
 * Then, because an increment is what this is usually for, it offers the increment letter, which
 * the api pre-fills from the revision just recorded.
 */
export default function SalaryRevisions({ employee }: { employee: Employee }) {
  const user = useQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser });
  const holdsPayroll = (user.data?.permissions ?? []).includes('PAYROLL' as never);
  const canWrite = hasWrite(user.data, 'PAYROLL');

  const revisions = useQuery({
    queryKey: ['hr', 'salary-revisions', employee.id],
    queryFn: () => listSalaryRevisions(employee.id),
    enabled: holdsPayroll,
  });

  const [recording, setRecording] = useState(false);
  const [letterFor, setLetterFor] = useState(false);
  const increment = useOfferableLetterKinds(INCREMENT_KIND, holdsPayroll);

  if (!holdsPayroll) return null;

  const columns: Column<SalaryRevision>[] = [
    {
      key: 'effective',
      header: 'Effective from',
      render: (row) => dateLabel(row.effectiveFrom),
    },
    {
      key: 'before',
      header: 'Gross before',
      numeric: true,
      render: (row) => money(row.previousGross),
    },
    {
      key: 'after',
      header: 'Gross after',
      numeric: true,
      render: (row) => money(row.gross),
    },
    {
      key: 'change',
      header: 'Change',
      numeric: true,
      render: (row) => {
        const delta = row.gross - row.previousGross;
        const pct = row.previousGross ? ` (${((delta / row.previousGross) * 100).toFixed(1)}%)` : '';
        return `${delta >= 0 ? '+' : '−'}${money(Math.abs(delta))}${pct}`;
      },
    },
    { key: 'remarks', header: 'Remarks', render: (row) => row.remarks || '—' },
  ];

  return (
    <section className="mt-8 flex flex-col gap-3" aria-labelledby="salary-revisions-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="salary-revisions-heading" className="text-sm font-medium text-gray-900">
          Revision history
        </h3>
        <div className="flex flex-wrap gap-2">
          {increment.kinds.length > 0 && (revisions.data ?? []).length > 0 && (
            <SecondaryButton type="button" onClick={() => setLetterFor(true)}>
              Generate increment letter
            </SecondaryButton>
          )}
          {canWrite && (
            // `intent="read"`: the gate is PAYROLL, checked just above, not the HR route's own
            // write permission — a payroll officer records revisions without editing employees.
            <Button intent="read" type="button" onClick={() => setRecording(true)}>
              Record revision
            </Button>
          )}
        </div>
      </div>

      {revisions.isError ? (
        <p className="text-sm text-red-600" role="alert">
          The revision history could not be loaded.
        </p>
      ) : (
        <DataTable
          caption="Salary revisions"
          columns={columns}
          rows={revisions.data ?? []}
          rowKey={(row) => row.id}
          emptyMessage={
            revisions.isPending ? 'Loading…' : 'No salary revision has been recorded.'
          }
        />
      )}

      {recording && (
        <RecordRevisionModal
          employee={employee}
          canOfferLetter={increment.kinds.length > 0}
          onClose={() => setRecording(false)}
          onGenerateLetter={() => {
            setRecording(false);
            setLetterFor(true);
          }}
        />
      )}

      {letterFor && (
        <GenerateLetterDialog
          recipient={{ employeeId: employee.id }}
          kindKeys={INCREMENT_KIND}
          initialKindKey="increment"
          onClose={() => setLetterFor(false)}
        />
      )}
    </section>
  );
}

function RecordRevisionModal({
  employee,
  canOfferLetter,
  onClose,
  onGenerateLetter,
}: {
  employee: Employee;
  canOfferLetter: boolean;
  onClose: () => void;
  onGenerateLetter: () => void;
}) {
  const queryClient = useQueryClient();
  const currentOf = (head: (typeof HEADS)[number]) =>
    (employee[head.current] as number | null) ?? null;

  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [values, setValues] = useState<Record<HeadKey, string>>(
    () =>
      Object.fromEntries(
        HEADS.map((head) => [head.key, currentOf(head)?.toString() ?? '']),
      ) as Record<HeadKey, string>,
  );
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SalaryRevision | null>(null);

  const currentGross = HEADS.reduce((sum, head) => sum + (currentOf(head) ?? 0), 0);
  const newGross = HEADS.reduce((sum, head) => {
    const typed = values[head.key].trim();
    return sum + (typed === '' ? currentOf(head) ?? 0 : Number(typed) || 0);
  }, 0);

  const mutation = useMutation({
    mutationFn: () => {
      const input: SalaryRevisionInput = { effectiveFrom };
      for (const head of HEADS) {
        const typed = values[head.key].trim();
        // Only heads that differ from today's: an omitted head keeps its value on the api.
        if (typed !== '' && Number(typed) !== (currentOf(head) ?? 0)) {
          input[head.key] = Number(typed);
        }
      }
      if (remarks.trim()) input.remarks = remarks.trim();
      return createSalaryRevision(employee.id, input);
    },
    onSuccess: (revision) => {
      setSaved(revision);
      void queryClient.invalidateQueries({ queryKey: ['hr', 'salary-revisions', employee.id] });
      void queryClient.invalidateQueries({ queryKey: ['hr', 'employee', employee.id] });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? (err.code && REVISION_REFUSALS[err.code]) || err.message
          : 'The revision could not be recorded.',
      ),
  });

  const invalidNumber = HEADS.some((head) => {
    const typed = values[head.key].trim();
    return typed !== '' && (Number.isNaN(Number(typed)) || Number(typed) < 0);
  });

  if (saved) {
    return (
      <Modal
        title="Revision recorded"
        onClose={onClose}
        footer={
          <>
            <SecondaryButton type="button" onClick={onClose}>
              Done
            </SecondaryButton>
            {canOfferLetter && (
              <Button intent="read" type="button" onClick={onGenerateLetter}>
                Generate increment letter
              </Button>
            )}
          </>
        }
      >
        <p className="text-sm text-gray-700" role="status">
          Monthly gross revised from {money(saved.previousGross)} to {money(saved.gross)}, with
          effect from {dateLabel(saved.effectiveFrom)}. Payroll pays the new figures from its next
          run.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Record salary revision"
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <Button
            intent="read"
            type="button"
            disabled={mutation.isPending || !effectiveFrom || invalidNumber}
            onClick={() => {
              setError(null);
              mutation.mutate();
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Record revision'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          This changes the employee’s pay straight away — payroll reads these figures. The
          effective date may be today or earlier, not later.
        </p>
        <FormError message={error} />
        <TextField
          id="revision-effective"
          label="Effective from"
          type="date"
          max={todayIso()}
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {HEADS.map((head) => (
            <TextField
              key={head.key}
              id={`revision-${head.key}`}
              label={`${head.label} (monthly ₹)`}
              hint={`Now ${money(currentOf(head))}`}
              type="number"
              min="0"
              step="0.01"
              value={values[head.key]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [head.key]: e.target.value }))
              }
            />
          ))}
        </div>
        <p className="text-sm text-gray-700">
          Monthly gross {money(currentGross)} → <strong>{money(newGross)}</strong>
        </p>
        <TextField
          id="revision-remarks"
          label="Remarks"
          placeholder="e.g. Annual increment 2026"
          maxLength={500}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>
    </Modal>
  );
}
