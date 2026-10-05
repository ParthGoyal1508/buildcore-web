import { z } from 'zod';

import { authFetch } from '@/app/lib/session';

/**
 * Every daily-work-report call to `buildcore-api` — the fourteen routes under `projects/dwr` (feature 022, 024 FR-001).
 *
 * One module per domain, per Constitution Principle V: no component issues its own `fetch()`. Every
 * response is parsed through a zod schema before the app trusts it (Principle IV), and the
 * `z.infer` type is what the UI consumes.
 *
 * ## Why this file did not exist until now
 *
 * `app/lib/api/projects.ts` says it plainly: *"DWR, revenue, budget and P&L still have no functions
 * here… a typed stub against an absent endpoint is a compile-time promise the runtime cannot
 * keep."* Fourteen endpoints exist as of feature 022, so the promise can now be kept.
 *
 * ## The one thing this module deliberately cannot do
 *
 * **There is no way to send a quantity for a measured line, and that is the point.** The API
 * computes every quantity — a measured line's is the product of its six factors, a presence-paid
 * line's is the day served — and `forbidNonWhitelisted` is on, so a request carrying a quantity is
 * a 400 rather than a figure that was quietly ignored. `MeasuredLineInput` below has no `quantity`
 * field for the same reason the DTO has none: a figure the client cannot send is a figure the
 * client cannot get wrong.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A quantity on the wire, which the API may send as a decimal string or a number.
 *
 * The `decimal` convention `app/lib/api/plant.ts` established and `billing.ts` reused. Kept as a
 * **string** here rather than coerced to a number, unlike those two: a measurement is `Decimal(18,3)`
 * and the screens below display it rather than computing with it, so the string the server sent is
 * the most faithful thing to show. `"0.000"` and `"0"` are the same number and different displays.
 */
const quantity = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v.toFixed(3) : v));

const nullableQuantity = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) =>
    v === null ? null : typeof v === 'number' ? v.toFixed(3) : v,
  );

export const DWR_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'returned',
] as const;
export type DwrStatus = (typeof DWR_STATUSES)[number];

export const DWR_PAYMENT_MODES = ['work_basis', 'day_basis'] as const;
export type DwrPaymentMode = (typeof DWR_PAYMENT_MODES)[number];

export const DWR_WEATHERS = ['clear', 'cloudy', 'rain', 'storm'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One line of a report as the API reads it back.
 *
 * `actualQty` and `servedQty` are **nullable and mutually exclusive**, which the database enforces
 * with a CHECK: a measured line carries the first and a presence line the second, and a row with
 * both or neither cannot exist. The UI reads whichever is present, so `quantityOf` below is the one
 * place that chooses — a component deciding for itself is how the two come to be displayed
 * differently on two screens.
 */
const dwrLineSchema = z
  .object({
    id: z.string(),
    paymentMode: z.enum(DWR_PAYMENT_MODES),
    boqItemId: z.string().nullable().optional(),
    boqNo: z.string().nullable().optional(),
    taskName: z.string().nullable().optional(),
    unit: z.string().nullable().optional(),
    equipmentId: z.string().nullable().optional(),
    actualQty: nullableQuantity.optional(),
    servedQty: nullableQuantity.optional(),
    length: nullableQuantity.optional(),
    breadth: nullableQuantity.optional(),
    depth: nullableQuantity.optional(),
    density: nullableQuantity.optional(),
    chainageFrom: z.string().nullable().optional(),
    chainageTo: z.string().nullable().optional(),
    layer: z.string().nullable().optional(),
    roadSide: z.string().nullable().optional(),
    section: z.string().nullable().optional(),
    engineerName: z.string().nullable().optional(),
    remark: z.string().nullable().optional(),
    exceedsScope: z.boolean().optional(),
  })
  .passthrough();

const dwrSchema = z
  .object({
    id: z.string(),
    reportNumber: z.string(),
    projectId: z.string(),
    workDate: z.string(),
    status: z.enum(DWR_STATUSES),
    weather: z.string().nullable().optional(),
    workerCount: z.number().nullable().optional(),
    machineryCount: z.number().nullable().optional(),
    progress: z.number().nullable().optional(),
    location: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    createdByUserId: z.string().nullable().optional(),
    submittedByUserId: z.string().nullable().optional(),
    submittedAt: z.string().nullable().optional(),
    approvedByUserId: z.string().nullable().optional(),
    approvedAt: z.string().nullable().optional(),
    reversedAt: z.string().nullable().optional(),
    reversalReason: z.string().nullable().optional(),
    reversalCount: z.number().optional(),
    tasks: z.array(dwrLineSchema).optional(),
    lines: z.array(dwrLineSchema).optional(),
    /**
     * Three things the API **reports rather than refuses** (022): a work date before the project
     * started, a second report for a day already covered, and a line past its BOQ scope. Named
     * here so the form can show them instead of a 201 that looks like nothing happened.
     */
    warnings: z.array(z.string()).optional(),
  })
  .passthrough();

export type Dwr = z.infer<typeof dwrSchema>;
export type DwrLine = z.infer<typeof dwrLineSchema>;

const dwrListSchema = z.union([
  z.array(dwrSchema),
  z.object({ items: z.array(dwrSchema) }).passthrough(),
]);

/** One BOQ line, per period, as 023 composes a bill from (022 FR-034 to FR-038). */
const periodFigureSchema = z
  .object({
    boqItemId: z.string(),
    boqNo: z.string(),
    taskName: z.string(),
    unit: z.string(),
    scopeQty: quantity,
    approvedInPeriod: quantity,
    approvedBefore: quantity,
    approvedUpToDate: quantity,
    doneQty: quantity,
  })
  .passthrough();

const periodFiguresSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    lines: z.array(periodFigureSchema),
  })
  .passthrough();

export type PeriodFigures = z.infer<typeof periodFiguresSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A measured line. **Dimensions, never a quantity** (024 FR-002).
 *
 * The server multiplies the six factors; an omitted factor is 1 and a factor of **zero is
 * refused** rather than treated as a missing one, because a zero that silently became a one is a
 * quantity nobody can explain.
 */
export interface MeasuredLineInput {
  paymentMode: 'work_basis';
  boqItemId?: string;
  nos?: string;
  length?: string;
  breadth?: string;
  depth?: string;
  density?: string;
  factor?: string;
  chainageFrom?: string;
  chainageTo?: string;
  layer?: string;
  roadSide?: string;
  section?: string;
  engineerName?: string;
  remark?: string;
}

/**
 * A presence-paid line: the day served, and nothing that looks like a dimension.
 *
 * **This shape carries no factor fields at all**, which is 022's FR-030b as a type rather than a
 * rule. All six factors default to 1 and their product is 1 — indistinguishable from one full day —
 * so a presence line that could carry them is a presence line whose quantity is right by
 * coincidence until somebody sets one.
 */
export interface PresenceLineInput {
  paymentMode: 'day_basis';
  boqItemId?: string;
  equipmentId?: string;
  /** `1.000` is one full day. Below a full day, `remark` is required (022 FR-030c, FR-030e). */
  servedQty: string;
  chainageFrom?: string;
  chainageTo?: string;
  layer?: string;
  roadSide?: string;
  section?: string;
  engineerName?: string;
  remark?: string;
}

export type DwrLineInput = MeasuredLineInput | PresenceLineInput;

export interface CreateDwrInput {
  workDate: string;
  weather?: string;
  workerCount?: number;
  machineryCount?: number;
  progress?: number;
  location?: string;
  description?: string;
  lines?: DwrLineInput[];
  /** Set after the API has reported a date before the project's start (022). */
  acknowledgeDateBeforeProjectStart?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calls
// ─────────────────────────────────────────────────────────────────────────────

export async function listDwrs(projectId?: string): Promise<Dwr[]> {
  const search = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const raw = await authFetch<unknown>(`/projects/dwr${search}`);
  const parsed = dwrListSchema.parse(raw);
  return Array.isArray(parsed) ? parsed : parsed.items;
}

export async function getDwr(dwrId: string): Promise<Dwr> {
  return dwrSchema.parse(await authFetch<unknown>(`/projects/dwr/${dwrId}`));
}

export async function createDwr(
  projectId: string,
  input: CreateDwrInput,
): Promise<Dwr> {
  return dwrSchema.parse(
    await authFetch<unknown>(`/projects/${projectId}/dwr`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function submitDwr(dwrId: string): Promise<Dwr> {
  return dwrSchema.parse(
    await authFetch<unknown>(`/projects/dwr/${dwrId}/submit`, {
      method: 'POST',
    }),
  );
}

/**
 * Approves a report, which is **what moves executed quantity** (022 FR-013 to FR-015).
 *
 * A submitted report changes nothing; approval increments every line's BOQ figure, all of them or
 * none. The API refuses an approval by the report's own author (FR-012a) and refuses a second
 * approval of the same report (FR-014).
 */
export async function approveDwr(dwrId: string): Promise<Dwr> {
  return dwrSchema.parse(
    await authFetch<unknown>(`/projects/dwr/${dwrId}/approve`, {
      method: 'POST',
    }),
  );
}

export async function returnDwr(dwrId: string, reason: string): Promise<Dwr> {
  return dwrSchema.parse(
    await authFetch<unknown>(`/projects/dwr/${dwrId}/return`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  );
}

/** Takes back exactly what approval added (022 FR-019), refused below what a bill has claimed. */
export async function reverseDwr(dwrId: string, reason: string): Promise<Dwr> {
  return dwrSchema.parse(
    await authFetch<unknown>(`/projects/dwr/${dwrId}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  );
}

export async function deleteDwr(dwrId: string): Promise<void> {
  await authFetch<unknown>(`/projects/dwr/${dwrId}`, { method: 'DELETE' });
}

/** What a bill proposes its quantities from (022 FR-034 to FR-038). */
export async function getPeriodFigures(
  projectId: string,
  from: string,
  to: string,
): Promise<PeriodFigures> {
  return periodFiguresSchema.parse(
    await authFetch<unknown>(
      `/projects/${projectId}/dwr/period-figures?from=${from}&to=${to}`,
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers — the one place that decides how a quantity is shown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The quantity a line carries, whichever column holds it.
 *
 * One function, so the two line kinds cannot be displayed differently on two screens. Returns
 * `null` for a line carrying neither, which the CHECK constraint makes impossible in the database
 * and which therefore means the API sent something unexpected — shown as a dash rather than as a
 * zero, because a zero is a measurement and this is the absence of one.
 */
export function quantityOf(line: DwrLine): string | null {
  if (line.paymentMode === 'work_basis') return line.actualQty ?? null;
  return line.servedQty ?? null;
}

/**
 * The quantity the server **will** compute for a measured line, shown before saving (024 FR-003).
 *
 * The same product the server applies, including the rule that an omitted factor is 1 — so the form
 * can show the figure rather than asking somebody to save and find out. `null` where a factor is
 * zero, which the server refuses by name: zero multiplied by anything is zero, and a line measuring
 * nothing is almost always a field left empty by mistake rather than work that did not happen.
 */
export function previewMeasuredQuantity(
  factors: Record<string, string | undefined>,
): string | null {
  const keys = ['nos', 'length', 'breadth', 'depth', 'density', 'factor'];
  let product = 1;
  for (const key of keys) {
    const raw = factors[key];
    if (raw === undefined || raw.trim() === '') continue;
    const value = Number(raw);
    if (Number.isNaN(value)) return null;
    if (value === 0) return null;
    product *= value;
  }
  return product.toFixed(3);
}

/** A full day, as 022 FR-030e fixes it: `1` means one whole day, not a rate or a unit. */
export const FULL_DAY = 1;
