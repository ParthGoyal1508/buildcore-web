'use client';

import { useQuery } from '@tanstack/react-query';

import { getMonthlyWages } from '@/app/lib/api/project-pnl';
import { PNL_COPY } from '@/app/lib/constants';
import { dateLabel, rupees } from '@/app/lib/format';

/**
 * One project's labour wages for one calendar month, by worker (018 FR-010a, FR-010b).
 *
 * `bugs.md` item 14's first half: *"a monthly labour wages summary per project (similar to staff
 * payroll)"*. The question it answers is "what did we pay this worker in September", which until now
 * meant opening several payment sheets and adding up — a fortnightly cycle puts two or three sheets
 * inside a month, and a month boundary falls inside one of them.
 *
 * ## Read-only, and that is a requirement (FR-010b)
 *
 * Wages are computed and corrected on the payment sheet. A second place to change them would be a
 * second answer to what somebody was paid, and the two would disagree the first time a sheet was
 * reopened. Nothing here is editable and nothing here is stored — the figures are read from the
 * sheets each time, so a sheet corrected later corrects this view.
 *
 * ## The apportionment is stated, not applied silently
 *
 * A sheet crossing the month boundary contributes only the days worked **inside** the month, taken
 * from the approved muster rather than from elapsed calendar days. FR-010a requires that be said,
 * and the server says it per sheet in its own words — rendered here rather than paraphrased, because
 * a figure the reader cannot account for is what this view exists to remove.
 *
 * ## A contractor month has nobody to list
 *
 * The spec's edge case. A contractor sheet is the contractor's basis of payment, not a disbursement
 * to the people named on it, so there are no per-worker rows — and the screen **says so** rather
 * than rendering blank, which would read as a loading failure.
 */
export default function MonthlyLabour({
  projectId,
  /** `YYYY-MM`, shared with the summary so both move together. */
  period,
}: {
  projectId: string;
  period: string;
}) {
  const [year, month] = period.split('-').map(Number);
  const wages = useQuery({
    queryKey: ['monthlyWages', projectId, period],
    queryFn: () => getMonthlyWages(projectId, year, month),
    enabled: Boolean(year && month),
  });

  if (wages.isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        {PNL_COPY.labourLoading}
      </p>
    );
  }
  if (wages.isError || !wages.data) {
    return (
      <p className="text-sm text-red-700" role="alert">
        {PNL_COPY.labourLoadFailed}
      </p>
    );
  }

  const view = wages.data;
  const contractorOnly =
    view.workers.length === 0 &&
    view.sheets.length > 0 &&
    view.sheets.every((sheet) => sheet.engagementType === 'contractor');

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">
          {PNL_COPY.labourHeading}
        </h2>
        <p className="mt-1 text-sm text-gray-600">{PNL_COPY.labourHint}</p>
      </div>

      {view.sheets.length === 0 ? (
        <p className="text-sm text-gray-600">{PNL_COPY.labourEmpty}</p>
      ) : (
        <>
          {view.draftSheetCount > 0 && (
            <p className="text-sm text-amber-900">
              {PNL_COPY.labourDraftSheets(view.draftSheetCount)}
            </p>
          )}

          {contractorOnly ? (
            <p className="rounded border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              {PNL_COPY.labourContractorOnly}
            </p>
          ) : (
            <>
              {/*
                Several hundred daily workers have to read as a list rather than as a wall, where
                the category total was one line. Sticky headers and a bounded scroll container do
                that without virtualization: these rows are read, not typed into, so rendering all
                of them costs a scroll and not a keystroke.
              */}
              <div className="max-h-[32rem] overflow-auto rounded border border-gray-200">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-600">
                    <tr>
                      <th className="px-2 py-2">
                        {PNL_COPY.labourColumns.worker}
                      </th>
                      <th className="px-2 py-2">
                        {PNL_COPY.labourColumns.code}
                      </th>
                      <th className="px-2 py-2 text-right">
                        {PNL_COPY.labourColumns.daysWorked}
                      </th>
                      <th className="px-2 py-2 text-right">
                        {PNL_COPY.labourColumns.rate}
                      </th>
                      <th className="px-2 py-2 text-right">
                        {PNL_COPY.labourColumns.gross}
                      </th>
                      <th className="px-2 py-2 text-right">
                        {PNL_COPY.labourColumns.deductions}
                      </th>
                      <th className="px-2 py-2 text-right">
                        {PNL_COPY.labourColumns.net}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.workers.map((worker) => (
                      <tr
                        key={worker.workerId}
                        className="border-t border-gray-100"
                      >
                        <td className="px-2 py-1.5 text-gray-900">
                          {worker.fullName ?? worker.workerId}
                          {worker.apportioned && (
                            <span
                              className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900"
                              title={PNL_COPY.labourApportionedHint}
                            >
                              {PNL_COPY.labourApportioned}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs text-gray-600">
                          {worker.labourCode ?? '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-700">
                          {worker.daysWorked}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-700">
                          {/* Null where two sheets applied different rates — a mid-month revision. */}
                          {worker.resolvedRate === null
                            ? 'Varied'
                            : rupees(worker.resolvedRate)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-900">
                          {rupees(worker.grossWage)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-700">
                          {rupees(worker.deductions)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums text-gray-900">
                          {rupees(worker.netPayable)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-gray-50">
                    <tr className="border-t border-gray-300">
                      <td
                        className="px-2 py-2 font-medium text-gray-900"
                        colSpan={4}
                      >
                        {view.workers.length} worker
                        {view.workers.length === 1 ? '' : 's'}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-900">
                        {rupees(view.grossTotal)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-700">
                        {rupees(view.deductionTotal)}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-gray-900">
                        {rupees(view.netTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-xs text-gray-500">{view.workersNote}</p>
            </>
          )}

          {/* The sheets behind the figures, with the apportionment the server stated. */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900">
              {PNL_COPY.labourSheetsHeading}
            </h3>
            <ul className="space-y-2 text-sm">
              {view.sheets.map((sheet) => (
                <li
                  key={sheet.sheetId}
                  className="rounded border border-gray-200 p-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-gray-900">
                      {dateLabel(sheet.periodFrom)} – {dateLabel(sheet.periodTo)}
                      <span className="ml-2 text-xs text-gray-500">
                        {sheet.engagementType}
                      </span>
                    </span>
                    <span className="tabular-nums text-gray-900">
                      {rupees(sheet.inMonth.grossTotal)}
                      {sheet.apportioned && (
                        <span className="ml-1 text-xs text-gray-500">
                          of {rupees(sheet.recorded.grossTotal)}
                        </span>
                      )}
                    </span>
                  </div>
                  {sheet.apportionment && (
                    <p className="mt-1 text-xs text-gray-600">
                      {sheet.apportionment.note}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-gray-500">{view.note}</p>
        </>
      )}
    </section>
  );
}
