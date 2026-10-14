'use client';

import { useMutation } from '@tanstack/react-query';
import clsx from 'clsx';
import { useRef, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  uploadTransactionSheet,
  type Reconciliation,
} from '@/app/lib/api/hr-payroll';
import { RECONCILIATION_COPY } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { FormError } from '@/app/ui/settings/form-fields';
import {
  SortHeader,
  TABLE,
  useSortedRows,
  type SortableColumn,
} from '@/app/ui/table';

/**
 * The bank's returned sheet against the run (021 FR-008 to FR-011) — `bugs.md` item 8.
 *
 * ## An unparseable row uploads and is reported
 *
 * The screen must make that visible rather than hiding it behind a success message. A row the parser
 * could not read appears in the table with its reason — because the person who has to fix it needs to
 * know *which* rows still line up, and a file rejected outright tells them nothing.
 *
 * ## Two kinds of gap, never one number
 *
 * A line matching no employee is money that moved to somebody the run does not know about. An
 * employee with no line is money that **did not move**. They are rendered as separate sections with
 * separate explanations, because a single "discrepancies" count sends both to whoever asked first.
 *
 * ## Differences are reported, not judged
 *
 * A transfer short by an advance recovery is correct. Nothing here flags a difference as wrong, and
 * the hint says so — a red row would have somebody chasing the bank about a deduction the company
 * made on purpose.
 */
export default function TransactionReconciliation({
  runId,
}: {
  runId: string;
}) {
  const [report, setReport] = useState<Reconciliation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: (file: File) => uploadTransactionSheet(runId, file),
    onSuccess: (result) => {
      setError(null);
      setReport(result);
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : RECONCILIATION_COPY.uploadFailed,
      ),
  });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-gray-900">
            {RECONCILIATION_COPY.heading}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {RECONCILIATION_COPY.hint}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // The value is cleared so choosing the same file twice fires again — somebody who
              // corrects the sheet and re-picks it would otherwise see nothing happen.
              event.target.value = '';
              if (file) {
                setError(null);
                upload.mutate(file);
              }
            }}
          />
          <Button
            type="button"
            disabled={upload.isPending}
            onClick={() => fileInput.current?.click()}
          >
            {upload.isPending
              ? RECONCILIATION_COPY.uploading
              : RECONCILIATION_COPY.upload}
          </Button>
        </div>
      </div>

      <FormError message={error} />

      {!report ? (
        <p className="text-sm text-gray-700">{RECONCILIATION_COPY.noneYet}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tally
              label={RECONCILIATION_COPY.tally.total}
              value={report.totalLines}
              tone="quiet"
            />
            <Tally
              label={RECONCILIATION_COPY.tally.matched}
              value={report.matched}
              tone="good"
            />
            <Tally
              label={RECONCILIATION_COPY.tally.unmatched}
              value={report.unmatched}
              tone={report.unmatched > 0 ? 'warn' : 'quiet'}
            />
            <Tally
              label={RECONCILIATION_COPY.tally.missing}
              value={report.missingFromSheet.length}
              tone={report.missingFromSheet.length > 0 ? 'warn' : 'quiet'}
            />
          </div>

          <p className="text-xs text-gray-500">
            {RECONCILIATION_COPY.differenceHint}
          </p>

          <SheetLinesTable lines={report.lines} />

          {report.unmatched > 0 && (
            <p
              className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-900"
              role="alert"
            >
              {RECONCILIATION_COPY.unmatchedHint}
            </p>
          )}

          {/* Its own section, not a row in the table above: these are not lines in the sheet, and
              putting them there would make "lines in sheet" a number that did not match the file. */}
          {report.missingFromSheet.length > 0 && (
            <section className="flex flex-col gap-2">
              <p
                className="rounded-md border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-900"
                role="alert"
              >
                {RECONCILIATION_COPY.missingHint}
              </p>
              <DataTable<MissingRow>
                caption={RECONCILIATION_COPY.missingHint}
                rows={report.missingFromSheet}
                rowKey={(row) => row.employeeId}
                columns={MISSING_COLUMNS}
              />
            </section>
          )}
        </>
      )}
    </section>
  );
}

type SheetLine = Reconciliation['lines'][number];
type MissingRow = Reconciliation['missingFromSheet'][number];

// Keys match the line's own fields, so the amounts sort as numbers (2026-10-15).
const LINE_COLUMNS: (SortableColumn<SheetLine> & {
  label: string;
  numeric?: boolean;
})[] = [
  {
    key: 'rowNumber',
    label: RECONCILIATION_COPY.columns.row,
    render: (line) => line.rowNumber,
  },
  {
    key: 'beneficiaryName',
    label: RECONCILIATION_COPY.columns.beneficiary,
    render: (line) => line.beneficiaryName,
  },
  {
    key: 'beneficiaryAccount',
    label: RECONCILIATION_COPY.columns.account,
    render: (line) => line.beneficiaryAccount,
  },
  {
    key: 'sheetAmount',
    label: RECONCILIATION_COPY.columns.sheetAmount,
    numeric: true,
    render: (line) => line.sheetAmount,
  },
  {
    key: 'runAmount',
    label: RECONCILIATION_COPY.columns.runAmount,
    numeric: true,
    render: (line) => line.runAmount,
  },
  {
    key: 'difference',
    label: RECONCILIATION_COPY.columns.difference,
    numeric: true,
    render: (line) => line.difference,
  },
  {
    key: 'matched',
    label: RECONCILIATION_COPY.columns.matched,
    render: (line) => line.matchedEmployeeCode ?? line.unmatchedReason,
  },
];

/**
 * The sheet's lines, sortable by any column. Written out rather than a `DataTable` because an
 * unmatched line tints its whole row, which `DataTable` has no hook for.
 */
function SheetLinesTable({ lines }: { lines: SheetLine[] }) {
  const { sorted, sort, toggle } = useSortedRows(lines, LINE_COLUMNS);
  return (
    <div className={TABLE.wrap}>
      <table className={TABLE.table}>
        <thead className={TABLE.thead}>
          <tr>
            {LINE_COLUMNS.map((column) => (
              <SortHeader
                key={column.key}
                label={column.label}
                columnKey={column.key}
                sort={sort}
                onSort={toggle}
                numeric={column.numeric}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((line) => (
            <tr
              key={line.rowNumber}
              className={clsx(
                TABLE.row,
                line.unmatchedReason && 'bg-amber-50/40',
              )}
            >
              <td className={clsx(TABLE.td, 'tabular-nums text-gray-500')}>
                {line.rowNumber}
              </td>
              <td className={TABLE.td}>{line.beneficiaryName ?? '—'}</td>
              <td className={clsx(TABLE.td, 'break-all text-xs text-gray-700')}>
                {line.beneficiaryAccount ?? '—'}
              </td>
              <td className={clsx(TABLE.td, TABLE.numeric)}>
                {rupees(line.sheetAmount)}
              </td>
              <td className={clsx(TABLE.td, TABLE.numeric)}>
                {rupees(line.runAmount)}
              </td>
              {/* Not coloured by sign. A difference is a fact to look at, not a verdict — see
                  the hint above. */}
              <td className={clsx(TABLE.td, TABLE.numeric)}>
                {line.difference === null ? '—' : rupees(line.difference)}
              </td>
              <td className={clsx(TABLE.td, 'text-xs')}>
                {line.matchedEmployeeCode ? (
                  <span className="text-gray-700">
                    {line.matchedEmployeeCode}
                  </span>
                ) : (
                  <span className="text-amber-900">{line.unmatchedReason}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MISSING_COLUMNS: Column<MissingRow>[] = [
  {
    key: 'employeeCode',
    header: RECONCILIATION_COPY.columns.employee,
    render: (row) => row.employeeCode,
  },
  {
    key: 'runAmount',
    header: RECONCILIATION_COPY.columns.runAmount,
    numeric: true,
    render: (row) => rupees(row.runAmount),
  },
];

function Tally({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'good' | 'warn' | 'quiet';
}) {
  const tones = {
    good: 'border-green-200 bg-green-50/60 text-green-900',
    warn: 'border-amber-200 bg-amber-50/60 text-amber-900',
    quiet: 'border-gray-200 bg-gray-50 text-gray-800',
  } as const;
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <p className="text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
