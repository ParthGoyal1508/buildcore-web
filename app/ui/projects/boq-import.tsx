'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  confirmBOQImport,
  validateBOQImport,
  type BoqImportReport,
} from '@/app/lib/api/projects';
import { BOQ_COPY } from '@/app/lib/constants';
import { rupees } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import { useProjectLock } from '@/app/ui/projects/project-lock-context';
import { SecondaryButton } from '@/app/ui/settings/form-fields';

/**
 * The tender import: upload, read the report, then confirm (008 FR-027 – FR-031).
 *
 * **The report shows what the import understood, not how many rows it accepted.** Both derived
 * totals sit beside the two the file states, with the difference and the tolerance. A count alone
 * tells somebody that something was read; it does not tell them whether it was read *correctly*,
 * and the failures this import can have — the far block swallowed, the wrong rate column, a
 * percentage silently zero — all produce a perfectly plausible count.
 *
 * **Every refusal has its own sentence** (FR-029), and two of the fourteen are deliberately not
 * failures: already-imported means it already worked, and in-progress means it is on its way.
 * Showing either as an error would send somebody to re-upload a schedule that is already in.
 */
export default function BoqImport({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { isLocked } = useProjectLock();
  const inputRef = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<BoqImportReport | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const read = useMutation({
    mutationFn: (file: File) => validateBOQImport(projectId, file),
    onSuccess: (next) => {
      setReport(next);
      setRefusal(null);
    },
    onError: (error: Error) => {
      setReport(null);
      setRefusal(messageFor(error));
    },
  });

  const commit = useMutation({
    mutationFn: (batchId: string) => confirmBOQImport(projectId, batchId),
    onSuccess: (result) => {
      setDone(BOQ_COPY.importDone(result.groups, result.lines));
      setReport(null);
      setRefusal(null);
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boq'] });
      void queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'boq-alerts'] });
      // The project itself carries the quoted percentage this import may have set.
      void queryClient.invalidateQueries({ queryKey: ['projects', 'portfolio', projectId] });
    },
    onError: (error: Error) => {
      // FR-031: a second confirm lands here, and "already imported" is an outcome rather than a
      // failure — the schedule is in, which is what the person wanted.
      setRefusal(messageFor(error));
      setReport(null);
    },
  });

  if (isLocked) return null;

  const blocked = report !== null && !report.totals.reconciles;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{BOQ_COPY.importHeading}</h3>
        <p className="text-xs text-gray-500">{BOQ_COPY.importHint}</p>
      </div>

      {done && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-900">
          {done}
        </p>
      )}

      {refusal && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {refusal}
        </p>
      )}

      {report === null && (
        <div>
          {/* `.xls` first in the accept list, because the client's own tender is the legacy
              format — which is the reason this whole amendment exists. */}
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700"
            disabled={read.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setDone(null);
              if (file) read.mutate(file);
            }}
          />
          {read.isPending && (
            <p className="mt-2 text-sm text-gray-500">{BOQ_COPY.importReading}</p>
          )}
        </div>
      )}

      {report && (
        <>
          <Report report={report} />
          <div className="flex flex-wrap gap-2">
            {/* FR-031: unavailable while the report says the file would be rejected. */}
            <Button
              type="button"
              disabled={commit.isPending || blocked}
              onClick={() => commit.mutate(report.batchId)}
            >
              {commit.isPending ? BOQ_COPY.importConfirming : BOQ_COPY.importConfirm}
            </Button>
            <SecondaryButton
              type="button"
              onClick={() => {
                setReport(null);
                if (inputRef.current) inputRef.current.value = '';
              }}
            >
              {BOQ_COPY.importDiscard}
            </SecondaryButton>
          </div>
        </>
      )}
    </section>
  );
}

/** The sentence for this refusal, by code — never a generic one where a code is known (FR-029). */
function messageFor(error: Error): string {
  if (error instanceof ApiError && error.code && error.code in BOQ_COPY.refusals) {
    return BOQ_COPY.refusals[error.code as keyof typeof BOQ_COPY.refusals];
  }
  return error.message || BOQ_COPY.refusalFallback;
}

function Report({ report }: { report: BoqImportReport }) {
  return (
    <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">{BOQ_COPY.reportHeading}</h4>
        <p className="text-sm text-gray-700">
          {BOQ_COPY.reportLines(report.lines, report.groups)}
        </p>
        <p className="text-xs text-gray-500">{BOQ_COPY.reportSheet(report.sheetName)}</p>
        <p className="text-xs text-gray-500">{BOQ_COPY.reportNothingWritten}</p>
      </div>

      {/* FR-027. Both derived totals beside the file's own, with the difference — the only thing
          on this screen that can show the import read the file correctly rather than merely
          read something. */}
      <table className="w-full text-sm">
        <caption className="sr-only">{BOQ_COPY.reportHeading}</caption>
        <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th scope="col" className="py-1" />
            <th scope="col" className="py-1 text-right">{BOQ_COPY.reportHeading}</th>
            <th scope="col" className="py-1 text-right">{BOQ_COPY.reportStated}</th>
            <th scope="col" className="py-1 text-right">{BOQ_COPY.reportDifference}</th>
          </tr>
        </thead>
        <tbody>
          <TotalRow
            label={BOQ_COPY.reportScheduleTotal}
            derived={report.totals.scheduleDerived}
            stated={report.totals.scheduleStated}
            difference={report.totals.scheduleDifference}
          />
          <TotalRow
            label={BOQ_COPY.reportQuotedTotal}
            derived={report.totals.quotedDerived}
            stated={report.totals.quotedStated}
            difference={report.totals.quotedDifference}
          />
        </tbody>
      </table>

      <p className={`text-sm ${report.totals.reconciles ? 'text-green-800' : 'text-red-800'}`}>
        {report.totals.reconciles
          ? `${BOQ_COPY.reportReconciles} (${BOQ_COPY.reportTolerance(rupees(report.totals.tolerance))})`
          : BOQ_COPY.reportDoesNotReconcile}
      </p>

      {/* FR-028. A condition to resolve, with its consequence in rupees — never a zero, and never
          silence, because the cost of a missing percentage is invisible on every other screen. */}
      <div>
        <p className="text-sm font-medium text-gray-900">{BOQ_COPY.reportPercentage}</p>
        {report.quotedPercentageFound && report.quotedPercentage !== null ? (
          <p className="text-sm text-gray-700 tabular-nums">
            {(report.quotedPercentage * 100).toFixed(2)}%
          </p>
        ) : (
          <p role="alert" className="text-sm text-amber-800">
            {BOQ_COPY.reportPercentageMissing}
          </p>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-gray-900">{BOQ_COPY.reportUnits}</p>
        <p className="text-xs text-gray-500">{BOQ_COPY.reportUnitsHint}</p>
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {report.units.map((unit) => (
            <li
              key={unit.asTyped}
              className="rounded bg-white px-2 py-0.5 text-xs text-gray-700 ring-1 ring-gray-200"
            >
              {/* As typed (FR-030), with the count rather than the normalised form: the client is
                  reading this against their own sheet, not against our matching rule. */}
              {unit.asTyped}
              <span className="ml-1 text-gray-400 tabular-nums">×{unit.lines}</span>
            </li>
          ))}
        </ul>
      </div>

      {report.errors.length > 0 && (
        <Problems title={BOQ_COPY.reportErrors(report.errors.length)} rows={report.errors} tone="red" />
      )}
      {/* Warnings listed apart from errors: a line grouped under the sheet name was imported, and
          calling it an error would make somebody go looking for a row that is fine. */}
      {report.warnings.length > 0 && (
        <Problems
          title={BOQ_COPY.reportWarnings(report.warnings.length)}
          rows={report.warnings}
          tone="amber"
        />
      )}
    </div>
  );
}

function TotalRow({
  label,
  derived,
  stated,
  difference,
}: {
  label: string;
  derived: number | null;
  stated: number | null;
  difference: number | null;
}) {
  return (
    <tr className="border-t border-gray-200">
      <th scope="row" className="py-1 text-left font-medium text-gray-700">
        {label}
      </th>
      <td className="py-1 text-right tabular-nums">{derived === null ? '—' : rupees(derived)}</td>
      <td className="py-1 text-right tabular-nums text-gray-600">
        {stated === null ? '—' : rupees(stated)}
      </td>
      <td className="py-1 text-right tabular-nums text-gray-600">
        {difference === null ? '—' : rupees(difference)}
      </td>
    </tr>
  );
}

function Problems({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { row: number; column: string; reason: string }[];
  tone: 'red' | 'amber';
}) {
  return (
    <details open={tone === 'red'}>
      <summary
        className={`cursor-pointer text-sm font-medium ${
          tone === 'red' ? 'text-red-800' : 'text-amber-800'
        }`}
      >
        {title}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left uppercase tracking-wide text-gray-500">
            <tr>
              <th scope="col" className="py-1 pr-3">{BOQ_COPY.reportColumnRow}</th>
              <th scope="col" className="py-1 pr-3">{BOQ_COPY.reportColumnColumn}</th>
              <th scope="col" className="py-1">{BOQ_COPY.reportColumnReason}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((problem) => (
              <tr key={`${problem.row}-${problem.column}`} className="border-t border-gray-200">
                <td className="py-1 pr-3 tabular-nums">{problem.row}</td>
                <td className="py-1 pr-3">{problem.column}</td>
                <td className="py-1 text-gray-700">{problem.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
