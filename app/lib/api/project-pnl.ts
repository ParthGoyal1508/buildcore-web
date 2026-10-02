import { z } from 'zod';

import { authFetch, authFetchBlob } from '@/app/lib/session';

/**
 * Every `/projects/pnl/*` and monthly-labour call to `buildcore-api` (feature 018 US3, US4 —
 * `bugs.md` items 11 and 14).
 *
 * Principle V: no component issues its own `fetch()`. Principle IV: every response is parsed before
 * the app trusts it.
 *
 * ## The two fields that carry the most meaning are the ones that say "no figure"
 *
 * `unavailableCategories` on the summary, and `records: null` with an `unavailableReason` on a
 * drill-down. Both exist because **"we could not ask" and "nothing was spent" are different facts**,
 * and a director acts differently on each: the first is a deployment problem, the second is a
 * project running under budget. Reporting the first as the second is how a project looks profitable
 * because half its costs are invisible. Neither is ever rendered as a zero — see `PNL_COPY`.
 */

const decimal = z
  .union([z.number(), z.string()])
  .transform((v) =>
    typeof v === 'number' ? v : v.trim() === '' ? NaN : Number(v),
  )
  .refine((v) => !Number.isNaN(v), { message: 'Not a number' });

const nullableDecimal = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) =>
    v === null
      ? null
      : typeof v === 'number'
        ? v
        : v.trim() === ''
          ? null
          : Number(v),
  )
  .refine((v) => v === null || !Number.isNaN(v), { message: 'Not a number' });

function qs(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// One project's position
// ─────────────────────────────────────────────────────────────────────────────

export const pnlCategorySchema = z.object({
  category: z.string(),
  monthly: decimal,
  cumulative: decimal,
  /** `null` means nobody set a budget — **not** that the budget is zero. */
  budget: nullableDecimal,
  /** Budget less cumulative. `null` when there is no budget to vary from. */
  variance: nullableDecimal,
});
export type PnlCategory = z.infer<typeof pnlCategorySchema>;

export const projectPnlSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  /** `YYYY-MM`. */
  period: z.string(),
  revenueMonthly: decimal,
  revenueCumulative: decimal,
  /**
   * What `revenue` counts, in the server's own words.
   *
   * Rendered rather than paraphrased: a reader comparing this figure to the bank will find a gap —
   * retention plus whatever is uncertified — and a figure somebody cannot reconcile is a figure they
   * stop trusting, along with the rest of the screen.
   */
  revenueNote: z.string(),
  categories: z.array(pnlCategorySchema),
  costMonthly: decimal,
  costCumulative: decimal,
  marginCumulative: decimal,
  /** Categories whose module registered no source. Named, never shown as zero (FR-010). */
  unavailableCategories: z.array(z.string()),
  /** True when a bill in the period measured past its contracted quantity. */
  revenueIncludesOverScope: z.boolean(),
});
export type ProjectPnl = z.infer<typeof projectPnlSchema>;

export async function getProjectPnl(
  projectId: string,
  period: string,
): Promise<ProjectPnl> {
  const raw = await authFetch<unknown>(
    `/projects/pnl${qs({ projectId, period })}`,
  );
  return projectPnlSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// The group board
// ─────────────────────────────────────────────────────────────────────────────

export const pnlGroupSchema = z.object({
  period: z.string(),
  rows: z.array(projectPnlSchema),
  /**
   * Summed from the rows, by the server, from the rows it returned.
   *
   * Which is also the visibility guarantee: a project the viewer may not see is absent from the
   * rows, so it is absent from the total. A total computed by a different path would leak the
   * existence of projects it included (FR-013).
   */
  totals: z.object({
    revenueCumulative: decimal,
    costCumulative: decimal,
    marginCumulative: decimal,
  }),
  unavailableCategories: z.array(z.string()),
});
export type PnlGroup = z.infer<typeof pnlGroupSchema>;

export async function getPnlGroup(
  projectIds: string[],
  period: string,
): Promise<PnlGroup> {
  const raw = await authFetch<unknown>(
    `/projects/pnl/group${qs({ projectIds: projectIds.join(','), period })}`,
  );
  return pnlGroupSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Opening a figure (FR-011, FR-012)
// ─────────────────────────────────────────────────────────────────────────────

/** Every figure on the summary that can be opened. */
export const DRILLABLE_FIGURES = [
  'revenue',
  'subcontractors',
  'labour',
  'materials',
  'machinery',
  'fuel',
  'overheads',
] as const;
export type DrillableFigure = (typeof DRILLABLE_FIGURES)[number];

export const drillRecordSchema = z.object({
  id: z.string(),
  /** What that module's users call the thing — a bill number, a sheet's period. */
  reference: z.string(),
  date: z.string(),
  amount: decimal,
  status: z.string().nullable(),
  description: z.string().nullable(),
});
export type DrillRecord = z.infer<typeof drillRecordSchema>;

export const drillDownSchema = z.object({
  projectId: z.string(),
  period: z.string(),
  figure: z.string(),
  scope: z.enum(['month', 'cumulative']),
  /**
   * Summed by the server from the records it returned, so the rows add up to the figure.
   *
   * `null` when the records could not be listed — never 0, which would read as "nothing here".
   */
  total: nullableDecimal,
  /**
   * `null` with `unavailableReason` set when this figure cannot be itemised.
   *
   * **Not an empty array.** An empty list says "nothing was spent"; this says "we cannot show you
   * what was", and those are different answers the screen must keep apart.
   */
  records: z.array(drillRecordSchema).nullable(),
  /** Where a fuller itemisation lives, when one does. Labour's per-worker register, today. */
  itemisedFurtherAt: z
    .object({ endpoint: z.string(), query: z.record(z.string()) })
    .nullable(),
  unavailableReason: z.string().nullable(),
});
export type PnlDrillDown = z.infer<typeof drillDownSchema>;

export async function getDrillDown(
  projectId: string,
  period: string,
  figure: DrillableFigure,
  scope: 'month' | 'cumulative' = 'month',
): Promise<PnlDrillDown> {
  const raw = await authFetch<unknown>(
    `/projects/pnl/drill-down${qs({ projectId, period, figure, scope })}`,
  );
  return drillDownSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// The monthly labour register (FR-010a)
// ─────────────────────────────────────────────────────────────────────────────

export const wageWorkerSchema = z.object({
  workerId: z.string(),
  labourCode: z.string().nullable(),
  fullName: z.string().nullable(),
  /** Days attributed to this month. Full day = 1, half day = 0.5, as the muster recorded it. */
  daysWorked: decimal,
  overtimeHours: decimal,
  /** `null` when two contributing sheets applied different rates — a mid-month revision. */
  resolvedRate: nullableDecimal,
  rateSource: z.string().nullable(),
  grossWage: decimal,
  deductions: decimal,
  netPayable: decimal,
  sheetIds: z.array(z.string()),
  apportioned: z.boolean(),
});
export type WageWorker = z.infer<typeof wageWorkerSchema>;

export const wageSheetSchema = z.object({
  sheetId: z.string(),
  periodFrom: z.string(),
  periodTo: z.string(),
  engagementType: z.string(),
  status: z.string(),
  /** The sheet's own totals, untouched. */
  recorded: z.object({
    grossTotal: decimal,
    deductionTotal: decimal,
    netTotal: decimal,
  }),
  /** What this month takes from the sheet. */
  inMonth: z.object({
    grossTotal: decimal,
    deductionTotal: decimal,
    netTotal: decimal,
  }),
  apportioned: z.boolean(),
  /**
   * How a straddling sheet was split, in the server's own words.
   *
   * Rendered rather than summarised. FR-010a requires the apportionment be stated, and a figure the
   * reader cannot account for is what this feature exists to remove.
   */
  apportionment: z
    .object({
      basis: z.string(),
      daysInMonth: decimal,
      daysInPeriod: decimal,
      placedByPeriodEnd: z.number(),
      note: z.string(),
    })
    .nullable(),
});
export type WageSheet = z.infer<typeof wageSheetSchema>;

export const monthlyWageRollupSchema = z.object({
  projectId: z.string(),
  projectCode: z.string().nullable(),
  projectName: z.string().nullable(),
  period: z.string(),
  monthStart: z.string(),
  monthEnd: z.string(),
  grossTotal: decimal,
  deductionTotal: decimal,
  netTotal: decimal,
  byEngagement: z.array(
    z.object({
      engagementType: z.string(),
      grossTotal: decimal,
      deductionTotal: decimal,
      netTotal: decimal,
      sheetCount: z.number(),
      workerCount: z.number(),
    }),
  ),
  /** Directly engaged workers only — `workersNote` says why. */
  workers: z.array(wageWorkerSchema),
  workersNote: z.string(),
  sheets: z.array(wageSheetSchema),
  /** Sheets overlapping the month that are still in draft, and therefore excluded. */
  draftSheetCount: z.number(),
  note: z.string(),
});
export type MonthlyWageRollup = z.infer<typeof monthlyWageRollupSchema>;

export async function getMonthlyWages(
  projectId: string,
  year: number,
  month: number,
): Promise<MonthlyWageRollup> {
  const raw = await authFetch<unknown>(
    `/labour/reports/monthly-wage-rollup${qs({ projectId, year, month })}`,
  );
  return monthlyWageRollupSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// The export (FR-010c)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The month's position as a document.
 *
 * A blob, because the endpoint serves a file. The production time is inside the document and in the
 * filename the server chooses — the browser keeps the latter, which is what lets two exports of the
 * same month sit in a downloads folder without one overwriting the other.
 */
export async function exportProjectPosition(
  projectId: string,
  period: string,
  format: 'pdf' | 'excel',
): Promise<Blob> {
  return authFetchBlob(
    `/projects/pnl/export${qs({ projectId, period, format })}`,
  );
}
