import { z } from 'zod';

import { authFetch } from '@/app/lib/session';

/**
 * Every `/projects/client-bills/*` and `/projects/ra-bills/*` call to `buildcore-api`
 * (feature 018 US1, US2 — `bugs.md` items 11 and 12).
 *
 * One module per domain, per Constitution Principle V: no component issues its own `fetch()`. Every
 * response is parsed through a zod schema before the app trusts it (Principle IV), and the
 * `z.infer` type is what the UI consumes.
 *
 * **Each schema below was written against the API's own view types**, not against the Prisma models
 * — `ClientBillView`, `RaBillView` and `BillableBoq` in
 * `buildcore-api/src/projects/billing/`. That matters here specifically: the API's views carry
 * derived fields the tables do not (`certificationVariance`, `remainingQty`, `unpriced`), and a
 * schema built from the schema file would silently discard exactly those. Five defects this cycle
 * were a field the server sent and a zod object did not name — `ApiError.details`,
 * `missingTypeIds`, `grants`, `selected`/`shortCode`, and `amountHidden`.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A money or quantity figure, which the API may send as a number or a decimal string.
 *
 * The same `decimal` convention `app/lib/api/plant.ts` established, deliberately reused rather than
 * re-invented (T005). A sheet summing hundreds of lines is the worst place in the product for a
 * `number` and a decimal string to meet: the error is small, silent, and lands in a figure somebody
 * quotes to a client.
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

/** The API sends dates as ISO strings; the UI formats them and never does arithmetic on them. */
const isoDate = z.string();

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
// The BOQ, as the sheet needs it
// ─────────────────────────────────────────────────────────────────────────────

export const billableBoqItemSchema = z.object({
  id: z.string(),
  boqNo: z.string(),
  taskName: z.string(),
  unit: z.string(),
  scopeQty: decimal,
  rate: decimal,
  /** The rate is still 0 — "nobody has priced this", not "this is free". */
  unpriced: z.boolean(),
  previouslyBilledQty: decimal,
  /** Negative where the line is already over-measured. Reported, not clamped. */
  remainingQty: decimal,
  isVariation: z.boolean(),
  variationRef: z.string().nullable(),
});
export type BillableBoqItem = z.infer<typeof billableBoqItemSchema>;

/**
 * A BOQ heading and its lines — the two-level shape the real file has.
 *
 * The client's own BOQ is 83 headings across 312 rows. A heading carries **no quantity and no rate**,
 * which is why it has none here: a flat list would have to give it zeros, and a zero quantity on a
 * heading reads as a real measured quantity of nothing.
 */
export const billableBoqGroupSchema = z.object({
  id: z.string(),
  boqNo: z.string(),
  name: z.string(),
  items: z.array(billableBoqItemSchema),
});
export type BillableBoqGroup = z.infer<typeof billableBoqGroupSchema>;

export const billableBoqSchema = z.object({
  projectId: z.string(),
  /** The bidder's quoted excess as a fraction — `0.0246` is 2.46%. */
  quotedPercentage: decimal,
  /** The schedule at its own rates. */
  estimatedTotal: decimal,
  /** That figure with the quoted percentage applied **once, to the total**. */
  quotedTotal: decimal,
  groups: z.array(billableBoqGroupSchema),
  unpricedCount: z.number(),
});
export type BillableBoq = z.infer<typeof billableBoqSchema>;

export async function getBillableBoq(projectId: string): Promise<BillableBoq> {
  const raw = await authFetch<unknown>(
    `/projects/client-bills/boq${qs({ projectId })}`,
  );
  return billableBoqSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Client bills
// ─────────────────────────────────────────────────────────────────────────────

export const clientBillLineSchema = z.object({
  id: z.string(),
  boqTaskItemId: z.string(),
  boqNo: z.string(),
  taskName: z.string(),
  unit: z.string(),
  scopeQty: decimal,
  quantity: decimal,
  /** The rate **as billed**, frozen at composition. Never today's BOQ rate (FR-006). */
  rate: decimal,
  amount: decimal,
  cumulativeQty: decimal,
  remainingQty: decimal,
  exceedsScope: z.boolean(),
  overScopeReason: z.string().nullable(),
  isVariation: z.boolean(),
  variationRef: z.string().nullable(),
});
export type ClientBillLine = z.infer<typeof clientBillLineSchema>;

export const clientBillSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  billNumber: z.string(),
  description: z.string().nullable(),
  billingDate: isoDate,
  status: z.string(),
  /** Frozen at composition alongside each line's rate. */
  quotedPercentage: decimal,
  grossAmount: decimal,
  retentionAmount: decimal,
  netAmount: decimal,
  certifiedAmount: nullableDecimal,
  certifiedAt: isoDate.nullable(),
  /**
   * The shortfall between billed and certified, where there is one.
   *
   * Named in this schema rather than derived in a component: it is the single most consequential
   * figure on the screen, and a client would otherwise have to notice that two columns differ.
   */
  certificationVariance: nullableDecimal,
  submittedAt: isoDate.nullable(),
  lines: z.array(clientBillLineSchema),
  exceedsScope: z.boolean(),
});
export type ClientBill = z.infer<typeof clientBillSchema>;

export interface ComposeBillLineInput {
  boqTaskItemId: string;
  quantity: number;
  overScopeReason?: string;
}

export interface ComposeBillInput {
  projectId: string;
  billNumber: string;
  description?: string;
  billingDate: string;
  lines: ComposeBillLineInput[];
  /** As a fraction. `0.05` is 5%. Withheld by the client, and not a project cost. */
  retentionPercent?: number;
}

export async function getClientBills(projectId: string): Promise<ClientBill[]> {
  const raw = await authFetch<unknown>(
    `/projects/client-bills${qs({ projectId })}`,
  );
  return z.array(clientBillSchema).parse(raw);
}

export async function getClientBill(id: string): Promise<ClientBill> {
  const raw = await authFetch<unknown>(`/projects/client-bills/${id}`);
  return clientBillSchema.parse(raw);
}

export async function composeClientBill(
  input: ComposeBillInput,
): Promise<ClientBill> {
  const raw = await authFetch<unknown>('/projects/client-bills', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return clientBillSchema.parse(raw);
}

export async function submitClientBill(id: string): Promise<ClientBill> {
  const raw = await authFetch<unknown>(`/projects/client-bills/${id}/submit`, {
    method: 'POST',
  });
  return clientBillSchema.parse(raw);
}

export async function certifyClientBill(
  id: string,
  certifiedAmount: number,
): Promise<ClientBill> {
  const raw = await authFetch<unknown>(`/projects/client-bills/${id}/certify`, {
    method: 'POST',
    body: JSON.stringify({ certifiedAmount }),
  });
  return clientBillSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcontractor RA bills
// ─────────────────────────────────────────────────────────────────────────────

export const raBillLineSchema = z.object({
  id: z.string(),
  workOrderBoqItemId: z.string(),
  /**
   * The client BOQ line this award line corresponds to, where it corresponds to one.
   *
   * Null is a real answer: a subcontract can cover work the client's BOQ itemises differently, and
   * forcing a match would make somebody invent one. But it is also what the award editor must read
   * back to **preserve** a link it did not create — re-saving an award without it unlinks every
   * line, and an unlinked line drops out of the floor a daily-work reversal is checked against.
   */
  boqTaskItemId: z.string().nullable(),
  description: z.string(),
  unit: z.string(),
  awardedQty: decimal,
  /** Measured on this bill. */
  thisPeriodQty: decimal,
  /** Measured on this bill and every earlier one. */
  toDateQty: decimal,
  /** Awarded less to-date. Negative when over-measured. */
  remainingQty: decimal,
  rate: decimal,
  amount: decimal,
});
export type RaBillLine = z.infer<typeof raBillLineSchema>;

export const raBillSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  workOrderId: z.string().nullable(),
  billNumber: z.string(),
  description: z.string().nullable(),
  billingDate: isoDate,
  status: z.string(),
  /**
   * Each deduction in its own right, never one net with the arithmetic hidden (FR-008).
   *
   * The basis is what makes a deduction arguable rather than merely imposed.
   */
  grossAmount: decimal,
  retentionAmount: decimal,
  advanceRecovery: decimal,
  otherDeductions: decimal,
  deductionTotal: decimal,
  netPayable: decimal,
  /**
   * What the project summary takes from this bill: **gross**.
   *
   * Carried on the response rather than left for a consumer to choose, because retention is money
   * withheld and an advance recovery is money already paid — neither is spend, and a summary reading
   * `netPayable` would understate every project by the retention held across it.
   */
  pnlAmount: decimal,
  lines: z.array(raBillLineSchema),
});
export type RaBill = z.infer<typeof raBillSchema>;

/** The award with what has been measured against it, before anybody types (FR-007). */
export const awardSchema = z.object({
  workOrderId: z.string(),
  /** As a fraction. The basis the retention figure is computed on. */
  retentionPercent: decimal,
  lines: z.array(raBillLineSchema),
});
export type Award = z.infer<typeof awardSchema>;

export interface AwardLineInput {
  description: string;
  unit: string;
  awardedQty: number;
  /** The **subcontractor's** rate, not the client's BOQ rate. */
  rate: number;
  boqTaskItemId?: string;
}

export interface MeasureLineInput {
  workOrderBoqItemId: string;
  quantity: number;
}

export interface ComposeRaBillInput {
  projectId: string;
  workOrderId: string;
  billNumber: string;
  description?: string;
  billingDate: string;
  lines: MeasureLineInput[];
  advanceRecovery?: number;
  otherDeductions?: number;
}

export interface ReviseRaBillInput {
  lines: MeasureLineInput[];
  /** Required. Somebody has to decide this bill a second time. */
  reason: string;
  advanceRecovery?: number;
  otherDeductions?: number;
}

export async function getRaBills(projectId: string): Promise<RaBill[]> {
  const raw = await authFetch<unknown>(`/projects/ra-bills${qs({ projectId })}`);
  return z.array(raBillSchema).parse(raw);
}

export async function getRaBill(id: string): Promise<RaBill> {
  const raw = await authFetch<unknown>(`/projects/ra-bills/${id}`);
  return raBillSchema.parse(raw);
}

/**
 * The award for a work order.
 *
 * `excludeBillId` when loading the sheet to **revise** an existing bill: without it the bill counts
 * its own quantities as measured, and every revision looks like an over-measurement of itself.
 */
export async function getAward(
  workOrderId: string,
  excludeBillId?: string,
): Promise<Award> {
  const raw = await authFetch<unknown>(
    `/projects/ra-bills/awards/${workOrderId}${qs({ excludeBillId })}`,
  );
  return awardSchema.parse(raw);
}

export async function setAward(
  workOrderId: string,
  lines: AwardLineInput[],
): Promise<RaBillLine[]> {
  const raw = await authFetch<unknown>(
    `/projects/ra-bills/awards/${workOrderId}`,
    { method: 'PUT', body: JSON.stringify({ lines }) },
  );
  return z.array(raBillLineSchema).parse(raw);
}

export async function composeRaBill(
  input: ComposeRaBillInput,
): Promise<RaBill> {
  const raw = await authFetch<unknown>('/projects/ra-bills', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return raBillSchema.parse(raw);
}

export async function submitRaBill(id: string): Promise<RaBill> {
  const raw = await authFetch<unknown>(`/projects/ra-bills/${id}/submit`, {
    method: 'POST',
  });
  return raBillSchema.parse(raw);
}

/**
 * Revises a bill's measured quantities (FR-009).
 *
 * The whole line set, not a patch: a bill's totals and its over-measurement check are properties of
 * all its lines together.
 *
 * **This invalidates the bill's approval.** The server keeps a completed approval as the record of
 * what was signed and raises a new one; a still-pending one is replaced. The warning belongs on the
 * screen *before* this is called — see `BILLING_COPY.reviseWarning`.
 */
export async function reviseRaBill(
  id: string,
  input: ReviseRaBillInput,
): Promise<RaBill> {
  const raw = await authFetch<unknown>(`/projects/ra-bills/${id}/lines`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return raBillSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Work orders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A work order, in the minimal form 018 needs.
 *
 * This is feature 008 User Story 6's surface delivered small: nothing had ever written to the table,
 * which left every RA bill screen reachable by nobody. When 008 US6 is built properly it should take
 * this over rather than add a second surface — so treat this module's work-order calls as a
 * placeholder with a known owner, not as the finished contract.
 */
export const workOrderSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  /** `partners.Vendor.id`. Resolved to a name through the partners endpoints, not here. */
  partnerId: z.string().nullable(),
  /**
   * `PRPL-WO-0001`. **Null on every work order raised before 027 numbered them** — the column was
   * added to a populated table, and inventing numbers for the existing rows would print figures on
   * documents nobody issued. Render the absence, never an empty string.
   */
  code: z.string().nullable(),
  workDetail: z.string(),
  terms: z.string().nullable(),
  requirements: z.string().nullable(),
  hireContract: z.string().nullable(),
  labourAmount: decimal,
  materialAmount: decimal,
  /** As a fraction. The basis every RA bill's retention is computed on. */
  retentionPercent: decimal,
  status: z.string(),
  /** 0 means no award has been captured, so nothing can be measured against it yet. */
  awardLineCount: z.number(),
  billCount: z.number(),
  createdAt: isoDate,
});
export type WorkOrder = z.infer<typeof workOrderSchema>;

export interface WorkOrderInput {
  projectId: string;
  /** The subcontractor. Optional: a work order can be raised before the vendor is settled. */
  partnerId?: string;
  workDetail: string;
  terms?: string;
  requirements?: string;
  hireContract?: string;
  labourAmount?: number;
  materialAmount?: number;
  /** As a fraction. Refused once a bill has been raised. */
  retentionPercent?: number;
  status?: string;
}

export async function getWorkOrders(projectId: string): Promise<WorkOrder[]> {
  const raw = await authFetch<unknown>(
    `/projects/work-orders${qs({ projectId })}`,
  );
  return z.array(workOrderSchema).parse(raw);
}

export async function createWorkOrder(
  input: WorkOrderInput,
): Promise<WorkOrder> {
  const raw = await authFetch<unknown>('/projects/work-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return workOrderSchema.parse(raw);
}

/**
 * What a work order still holds back, and every release against it (025 FR-032).
 *
 * All three figures, not just the balance: a subcontractor asking "how much are you still holding"
 * is really asking "and how did it get to that", and a single number sends somebody to add up bills
 * by hand to answer the second half.
 */
const retentionLedgerSchema = z
  .object({
    workOrderId: z.string(),
    retentionPercent: z.number(),
    withheld: z.number(),
    released: z.number(),
    outstanding: z.number(),
    releases: z.array(
      z
        .object({
          id: z.string(),
          amount: z.number(),
          releasedOn: z.string(),
          reason: z.string().nullable(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type RetentionLedger = z.infer<typeof retentionLedgerSchema>;

export async function getRetention(
  workOrderId: string,
): Promise<RetentionLedger> {
  return retentionLedgerSchema.parse(
    await authFetch<unknown>(`/projects/ra-bills/retention/${workOrderId}`),
  );
}

/**
 * Records retention going back to the subcontractor.
 *
 * **An act somebody performs, never a schedule the system runs** — the client's own decision.
 * Append-only: there is no edit, because the row *is* the evidence that money moved.
 */
export async function releaseRetention(
  workOrderId: string,
  input: { amount: number; releasedOn: string; reason: string },
): Promise<RetentionLedger> {
  return retentionLedgerSchema.parse(
    await authFetch<unknown>(
      `/projects/ra-bills/retention/${workOrderId}/release`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  );
}

export async function updateWorkOrder(
  id: string,
  input: Partial<WorkOrderInput>,
): Promise<WorkOrder> {
  const raw = await authFetch<unknown>(`/projects/work-orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return workOrderSchema.parse(raw);
}
