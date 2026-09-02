'use client';

import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  commitAttendanceImport,
  downloadAttendanceImportTemplate,
  saveBlob,
  validateAttendanceImport,
  type ImportResult,
} from '@/app/lib/api/hr-payroll';
import { HR_MESSAGES } from '@/app/lib/constants';
import { Button } from '@/app/ui/button';
import DataTable, { type Column } from '@/app/ui/hr/data-table';
import { FormError, SecondaryButton } from '@/app/ui/settings/form-fields';

interface RowError {
  row: number;
  errors: string[];
}

/** Both shapes the backend may use for the rejected-row list. */
function rejectedOf(result: ImportResult | null | undefined): RowError[] {
  return result?.rejected ?? result?.errors ?? [];
}

/**
 * Bulk attendance import (005 US13).
 *
 * Validate-then-commit, always in that order and never as one step. An import
 * that half-succeeds silently is the worst outcome here: attendance is the input
 * to payroll, and a row that failed for a reason nobody read becomes a wrong
 * salary. So the file is dry-run first, the rejected rows are shown with their
 * reasons, and committing is a second, deliberate act on a result the admin has
 * already seen.
 */
export default function AttendanceImportPanel() {
  const queryClient = useQueryClient();
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [validation, setValidation] = useState<ImportResult | null>(null);
  const [committed, setCommitted] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Offered before the file picker, because guessing the column order is the
  // first thing that goes wrong with a bulk import.
  const template = useMutation({
    mutationFn: async () => {
      const { blob, filename } = await downloadAttendanceImportTemplate();
      saveBlob(blob, filename);
    },
    onError: (err: Error) => setError(err.message),
  });

  const validate = useMutation({
    mutationFn: () => validateAttendanceImport(csv),
    onSuccess: (result) => {
      setValidation(result);
      setCommitted(null);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const commit = useMutation({
    mutationFn: () => commitAttendanceImport(csv),
    onSuccess: (result) => {
      setCommitted(result);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const rejected = rejectedOf(validation);
  const validRows = validation?.validRows ?? 0;
  const nothingValid = validation !== null && validRows === 0;

  const columns: Column<RowError>[] = [
    { key: 'row', header: 'Row', numeric: true, render: (row) => row.row },
    {
      key: 'errors',
      header: 'Why it was rejected',
      render: (row) => row.errors.join('; '),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-gray-200 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-600">
            Start from the template so the columns are in the order the importer
            expects.
          </p>
          <SecondaryButton
            type="button"
            onClick={() => template.mutate()}
            disabled={template.isPending}
          >
            {template.isPending ? 'Preparing…' : 'Download template'}
          </SecondaryButton>
        </div>
        <label
          htmlFor="import-file"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Attendance CSV
        </label>
        <input
          id="import-file"
          type="file"
          accept=".csv,text/csv"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setFileName(file.name);
            setCsv(await file.text());
            setValidation(null);
            setCommitted(null);
          }}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-50"
        />
        {fileName && (
          <p className="mt-2 text-sm text-gray-600">
            {fileName} · {csv.split('\n').filter(Boolean).length - 1} data rows
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <SecondaryButton
            type="button"
            onClick={() => validate.mutate()}
            disabled={!csv || validate.isPending}
          >
            {validate.isPending ? 'Checking…' : 'Check file'}
          </SecondaryButton>
          <Button
            type="button"
            onClick={() => commit.mutate()}
            // Committing is only offered once the file has been checked and at
            // least one row survived — there is nothing to import otherwise.
            disabled={!validation || nothingValid || commit.isPending}
          >
            {commit.isPending ? 'Importing…' : 'Import valid rows'}
          </Button>
        </div>
      </div>

      <FormError message={error} />

      {validation && (
        <div
          className={
            nothingValid
              ? 'rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'
              : 'rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800'
          }
          role="status"
        >
          {nothingValid
            ? HR_MESSAGES.importNothingValid
            : HR_MESSAGES.importPartial(validRows, rejected.length)}
        </div>
      )}

      {committed && (
        <div
          className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800"
          role="status"
        >
          Imported {committed.imported ?? validRows} rows.
        </div>
      )}

      {rejected.length > 0 && (
        <DataTable
          caption="Rejected rows"
          columns={columns}
          rows={rejected}
          rowKey={(row) => String(row.row)}
          emptyMessage="No rejected rows."
        />
      )}
    </div>
  );
}
