'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';

import {
  DRILLABLE_FIGURES,
  exportProjectPosition,
  getProjectPnl,
  type DrillableFigure,
} from '@/app/lib/api/project-pnl';
import { PNL_COPY } from '@/app/lib/constants';
import { currentPeriod, periodLabel, rupees } from '@/app/lib/format';
import MonthlyLabour from '@/app/ui/projects/monthly-labour';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import PnlDrillDown from '@/app/ui/projects/pnl-drill-down';
import { RowAction, SecondaryButton } from '@/app/ui/settings/form-fields';
import { TABLE } from '@/app/ui/table';

/**
 * One project's position for one month (018 US3, FR-010 to FR-012 — `bugs.md` item 11).
 *
 * ## A category nobody could ask about is named, never shown as zero
 *
 * The single most consequential rule on this screen. `unavailableCategories` lists the cost
 * categories whose module registered no source, and those rows read **"Not available"** and are
 * excluded from the totals — because "we could not ask" and "nothing was spent" are different facts
 * and a director acts differently on each. Showing the first as the second is how a project looks
 * profitable because half its costs are invisible, with nothing on the screen saying so.
 *
 * ## Changing the month moves every figure together (FR-012)
 *
 * One query per month, keyed on the period, so there is never a moment where revenue is August's and
 * labour is September's. The labour register below shares the same period for the same reason — a
 * figure-by-figure refresh would show a mixed-period state that each individual number would
 * defend.
 *
 * ## Revenue is gross, and the screen says what that means
 *
 * `revenueNote` comes from the server and is rendered rather than paraphrased: a reader comparing
 * this to the bank will find a gap — retention plus whatever is uncertified — and a figure somebody
 * cannot reconcile is a figure they stop trusting, along with the rest of the screen.
 */
export default function ProjectSummary({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName?: string;
}) {
  const [period, setPeriod] = useState(currentPeriod);
  const [open, setOpen] = useState<DrillableFigure | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  // The PDF export reads in the page's own viewer (2026-10-14) rather than a new tab opened after
  // the fetch, which most browsers block; the workbook is saved under a real name.
  const { show, viewer } = useFileViewer();

  const pnl = useQuery({
    // The period is in the key, so changing the month refetches rather than showing last month's
    // figures under this month's heading — the failure mode that looks like it is working.
    queryKey: ['projectPnl', projectId, period],
    queryFn: () => getProjectPnl(projectId, period),
  });

  const download = async (format: 'pdf' | 'excel') => {
    setExportError(null);
    setExporting(format);
    try {
      const blob = await exportProjectPosition(projectId, period, format);
      show(
        { blob },
        `Project position ${period}.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
        `Project position — ${periodLabel(period)}`,
      );
    } catch {
      setExportError(PNL_COPY.exportFailed);
    } finally {
      setExporting(null);
    }
  };

  const view = pnl.data;
  const unavailable = view?.unavailableCategories ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            {PNL_COPY.heading}
          </h2>
          {projectName && (
            <p className="text-sm text-gray-600">{projectName}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">
              {PNL_COPY.monthLabel}
            </span>
            {/* `h-11 sm:h-10` are `SecondaryButton`'s own heights, taken rather than guessed at:
                this field sits in a row with two of them, and `sm:min-h-0` left it 30px tall
                against their 40px — bottom-aligned, so the mismatch read as a misaligned button
                rather than a short input. 44px below `sm` is the touch target. */}
            <input
              type="month"
              value={period}
              // Up to this month, as on the P&L board (2026-10-18).
              max={currentPeriod()}
              onChange={(event) => {
                const next = event.target.value;
                if (next && next <= currentPeriod()) setPeriod(next);
              }}
              className="h-11 rounded border border-gray-300 px-3 text-sm sm:h-10"
            />
          </label>
          <div className="flex gap-2">
            <SecondaryButton
              type="button"
              disabled={exporting !== null || !view}
              onClick={() => void download('pdf')}
            >
              {exporting === 'pdf'
                ? PNL_COPY.exporting
                : `${PNL_COPY.exportLabel} — ${PNL_COPY.exportPdf}`}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={exporting !== null || !view}
              onClick={() => void download('excel')}
            >
              {exporting === 'excel'
                ? PNL_COPY.exporting
                : PNL_COPY.exportExcel}
            </SecondaryButton>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">{PNL_COPY.exportHint}</p>
      {viewer}
      {exportError && (
        <p className="text-sm text-red-700" role="alert">
          {exportError}
        </p>
      )}

      {pnl.isLoading && (
        <p className="text-sm text-gray-500" role="status">
          {PNL_COPY.loading}
        </p>
      )}
      {pnl.isError && (
        <p className="text-sm text-red-700" role="alert">
          {PNL_COPY.loadFailed}
        </p>
      )}

      {view && (
        <>
          {view.revenueIncludesOverScope && (
            <p className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
              {PNL_COPY.overScopeWarning}
            </p>
          )}

          {/* The shared look but no sorting (2026-10-15): this is a statement read top to bottom —
              revenue, each cost, total cost, margin — and an unavailable category spans its row. */}
          <div className={TABLE.wrap}>
            <table className={clsx(TABLE.table, 'w-full min-w-[40rem]')}>
              <caption className="sr-only">
                {`${PNL_COPY.heading} — ${periodLabel(view.period)}`}
              </caption>
              <thead className={TABLE.thead}>
                <tr>
                  <th className={TABLE.th}>{PNL_COPY.columns.line}</th>
                  <th className={clsx(TABLE.th, 'text-right')}>
                    {PNL_COPY.columns.monthly}
                  </th>
                  <th className={clsx(TABLE.th, 'text-right')}>
                    {PNL_COPY.columns.cumulative}
                  </th>
                  <th className={clsx(TABLE.th, 'text-right')}>
                    {PNL_COPY.columns.budget}
                  </th>
                  <th className={clsx(TABLE.th, 'text-right')}>
                    {PNL_COPY.columns.variance}
                  </th>
                </tr>
              </thead>
              <tbody>
                <FigureRow
                  label={PNL_COPY.revenue}
                  monthly={view.revenueMonthly}
                  cumulative={view.revenueCumulative}
                  figure="revenue"
                  open={open}
                  onToggle={setOpen}
                />
                {view.categories.map((row) => {
                  const isUnavailable = unavailable.includes(row.category);
                  return (
                    <FigureRow
                      key={row.category}
                      label={PNL_COPY.categories[row.category] ?? row.category}
                      monthly={row.monthly}
                      cumulative={row.cumulative}
                      budget={row.budget}
                      variance={row.variance}
                      // Named, never zeroed. The row carries the words, not a 0.00.
                      unavailable={isUnavailable}
                      figure={
                        DRILLABLE_FIGURES.includes(
                          row.category as DrillableFigure,
                        )
                          ? (row.category as DrillableFigure)
                          : undefined
                      }
                      open={open}
                      onToggle={setOpen}
                    />
                  );
                })}
              </tbody>
              <tfoot className={TABLE.tfoot}>
                <tr>
                  <td className={clsx(TABLE.td, 'text-gray-900')}>
                    {PNL_COPY.totalCost}
                  </td>
                  <td
                    className={clsx(TABLE.td, TABLE.numeric, 'text-gray-900')}
                  >
                    {rupees(view.costMonthly)}
                  </td>
                  <td
                    className={clsx(TABLE.td, TABLE.numeric, 'text-gray-900')}
                  >
                    {rupees(view.costCumulative)}
                  </td>
                  <td colSpan={2} />
                </tr>
                <tr>
                  <td className={clsx(TABLE.td, 'text-gray-900')}>
                    {PNL_COPY.margin}
                  </td>
                  <td className={TABLE.td} />
                  <td
                    className={clsx(
                      TABLE.td,
                      TABLE.numeric,
                      view.marginCumulative < 0
                        ? 'text-red-700'
                        : 'text-gray-900',
                    )}
                  >
                    {rupees(view.marginCumulative)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="text-xs text-gray-500">{view.revenueNote}</p>
          {unavailable.length > 0 && (
            <p className="text-sm text-amber-900">
              {PNL_COPY.unavailableHint(
                unavailable
                  .map((category) => PNL_COPY.categories[category] ?? category)
                  .join(', '),
              )}
            </p>
          )}

          {open && (
            <div className="rounded border border-gray-200 p-3">
              <PnlDrillDown
                projectId={projectId}
                period={period}
                figure={open}
                label={
                  open === 'revenue'
                    ? PNL_COPY.revenue
                    : (PNL_COPY.categories[open] ?? open)
                }
                expected={
                  open === 'revenue'
                    ? view.revenueMonthly
                    : (view.categories.find((row) => row.category === open)
                        ?.monthly ?? 0)
                }
              />
            </div>
          )}

          {/* Shares the summary's period, so the two can never show different months. */}
          <MonthlyLabour projectId={projectId} period={period} />
        </>
      )}
    </div>
  );
}

function FigureRow({
  label,
  monthly,
  cumulative,
  budget,
  variance,
  unavailable = false,
  figure,
  open,
  onToggle,
}: {
  label: string;
  monthly: number;
  cumulative: number;
  budget?: number | null;
  variance?: number | null;
  unavailable?: boolean;
  figure?: DrillableFigure;
  open: DrillableFigure | null;
  onToggle: (figure: DrillableFigure | null) => void;
}) {
  return (
    <tr className={TABLE.row}>
      <td className={clsx(TABLE.td, 'text-gray-900')}>
        {figure ? (
          <RowAction
            type="button"
            // `intent="read"` because opening a figure writes nothing — without it the control
            // would vanish for a read-only viewer, who is exactly who reads a P&L.
            intent="read"
            className="min-h-11 sm:min-h-0"
            aria-expanded={open === figure}
            onClick={() => onToggle(open === figure ? null : figure)}
          >
            {label}
          </RowAction>
        ) : (
          label
        )}
      </td>
      {unavailable ? (
        // One cell across the figures: a "Not available" under each column would read as four
        // separate absences rather than one category nobody could ask about.
        <td
          colSpan={4}
          className={clsx(TABLE.td, 'text-right font-medium text-amber-900')}
        >
          {PNL_COPY.unavailable}
        </td>
      ) : (
        <>
          <td className={clsx(TABLE.td, TABLE.numeric, 'text-gray-900')}>
            {rupees(monthly)}
          </td>
          <td className={clsx(TABLE.td, TABLE.numeric, 'text-gray-900')}>
            {rupees(cumulative)}
          </td>
          <td className={clsx(TABLE.td, TABLE.numeric, 'text-gray-600')}>
            {/* Null means nobody set a budget — not that the budget is zero. */}
            {budget === null || budget === undefined ? '—' : rupees(budget)}
          </td>
          <td
            className={clsx(
              TABLE.td,
              TABLE.numeric,
              variance !== null && variance !== undefined && variance < 0
                ? 'font-medium text-red-700'
                : 'text-gray-600',
            )}
          >
            {variance === null || variance === undefined
              ? '—'
              : rupees(variance)}
          </td>
        </>
      )}
    </tr>
  );
}
