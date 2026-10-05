import { z } from 'zod';

import type { StoredFile } from '@/app/lib/api/client';
import { authFetch, authFetchFile } from '@/app/lib/session';

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
 * ## The document this module is aligned to
 *
 * **`specs/022-daily-work-reports-backend/contracts/dwr-api.md` in `buildcore-api`.** Read it before
 * changing a schema here. This module was first written against a guess of that document and was
 * wrong in four places at once, so a successful save rendered as a parse error and the engineer who
 * made it believed the day was lost.
 *
 * Nothing automated checks this file against that one: `buildcore-web` has no test runner, and
 * feature 025 declined to introduce a framework, a config and a CI step to run a single assertion
 * (research.md section 3). What *is* pinned is the server's side — `test/dwr.e2e-spec.ts` asserts
 * the exact key set of the creation response and of a list row, so the shape this module trusts
 * cannot drift silently. The remaining gap is this file reading that shape correctly, and the only
 * thing closing it is somebody opening the contract.
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
    /** The quantity whichever basis produced, as the detail read reports it. */
    quantityInForce: nullableQuantity.optional(),
    /** All six factors. `nos1` and `nos2` were missing here, and so never rendered. */
    nos1: nullableQuantity.optional(),
    nos2: nullableQuantity.optional(),
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

const attachmentSchema = z
  .object({
    id: z.string(),
    fileName: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number(),
  })
  .passthrough();

export type DwrAttachment = z.infer<typeof attachmentSchema>;

/**
 * A fact the API reports **beside** a success, never instead of one (022 FR-025).
 *
 * An object, not a string: a code the app can branch on, a sentence written for the person reading
 * it, and whatever detail that person needs to act — the report number of the day already covered,
 * the project's start date, the BOQ number of the line past its scope. The three are a work date
 * before the project started, a second report for a date already covered, and a line past its BOQ
 * scope, and **all three accompany a 201**.
 */
const warningSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    detail: z.record(z.unknown()).optional(),
  })
  .passthrough();

export type DwrWarning = z.infer<typeof warningSchema>;

/**
 * One report as the **detail** read returns it (`GET /projects/dwr/:dwrId`).
 *
 * Distinct from the list item below, and that distinction is the defect this module was repaired
 * for: a single schema demanding the detail's fields was used to parse the list, the creation
 * response and every lifecycle action, so a successful save rendered as a parse error naming three
 * fields the server has never sent.
 */
const dwrSchema = z
  .object({
    id: z.string(),
    dprNumber: z.string(),
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
    attachments: z.array(attachmentSchema).optional(),
  })
  .passthrough();

export type Dwr = z.infer<typeof dwrSchema>;
export type DwrLine = z.infer<typeof dwrLineSchema>;

/**
 * One row of the **list**, which is a page of summaries and nothing more.
 *
 * `lineCount` is a count. **There is no lines array here** — rendering one from this response is
 * what made the Lines column read "none" for every report regardless of what the day contained.
 * The lines themselves are on the detail read, which is one click away.
 *
 * `createdByUserId` and `submittedByUserId` are carried so the Approve control can show 022
 * FR-012a *before* the action rather than after it (025 FR-006).
 */
const dwrSummarySchema = z
  .object({
    id: z.string(),
    dprNumber: z.string(),
    workDate: z.string(),
    status: z.enum(DWR_STATUSES),
    workerCount: z.number().nullable().optional(),
    machineryCount: z.number().nullable().optional(),
    progress: z.number().nullable().optional(),
    lineCount: z.number(),
    createdByUserId: z.string().nullable().optional(),
    submittedByUserId: z.string().nullable().optional(),
    reversedAt: z.string().nullable().optional(),
  })
  .passthrough();

export type DwrSummary = z.infer<typeof dwrSummarySchema>;

const dwrListSchema = z
  .object({
    items: z.array(dwrSummarySchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  })
  .passthrough();

/**
 * What recording a day returns — **an identifier, a number, a status and the warnings**.
 *
 * No `projectId`. No `workDate`. No lines. A client that demands them back rejects every successful
 * save, which is precisely what happened: the server recorded the day, answered 201, and the screen
 * showed a parse error, so the day was recorded and believed lost.
 */
const createdDwrSchema = z
  .object({
    id: z.string(),
    dprNumber: z.string(),
    status: z.enum(DWR_STATUSES),
    warnings: z.array(warningSchema).default([]),
  })
  .passthrough();

export type CreatedDwr = z.infer<typeof createdDwrSchema>;

/**
 * What a lifecycle action returns. Each is narrower than the detail read: submit and return answer
 * `{ id, status }`, approve adds what it moved, reverse adds the count, and editing a draft adds
 * the same warnings a creation carries.
 */
const dwrActionSchema = z
  .object({
    id: z.string(),
    status: z.enum(DWR_STATUSES),
    moved: z
      .array(z.object({ boqNo: z.string(), delta: quantity }).passthrough())
      .optional(),
    reversalCount: z.number().optional(),
    warnings: z.array(warningSchema).default([]),
  })
  .passthrough();

export type DwrActionResult = z.infer<typeof dwrActionSchema>;

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
  /**
   * The server's own six names (`create-dwr.dto.ts`), not an approximation of them. The global
   * pipe runs at `forbidNonWhitelisted`, so a field this client invents is a **400** rather than a
   * figure quietly dropped — `nos` and `factor` were invented here and made every measured line
   * carrying them unsaveable.
   */
  nos1?: string;
  nos2?: string;
  length?: string;
  breadth?: string;
  depth?: string;
  density?: string;
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

export async function listDwrs(projectId?: string): Promise<DwrSummary[]> {
  const search = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const raw = await authFetch<unknown>(`/projects/dwr${search}`);
  return dwrListSchema.parse(raw).items;
}

export async function getDwr(dwrId: string): Promise<Dwr> {
  return dwrSchema.parse(await authFetch<unknown>(`/projects/dwr/${dwrId}`));
}

export async function createDwr(
  projectId: string,
  input: CreateDwrInput,
): Promise<CreatedDwr> {
  return createdDwrSchema.parse(
    await authFetch<unknown>(`/projects/${projectId}/dwr`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function submitDwr(dwrId: string): Promise<DwrActionResult> {
  return dwrActionSchema.parse(
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
export async function approveDwr(dwrId: string): Promise<DwrActionResult> {
  return dwrActionSchema.parse(
    await authFetch<unknown>(`/projects/dwr/${dwrId}/approve`, {
      method: 'POST',
    }),
  );
}

export async function returnDwr(dwrId: string, reason: string): Promise<DwrActionResult> {
  return dwrActionSchema.parse(
    await authFetch<unknown>(`/projects/dwr/${dwrId}/return`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  );
}

/** Takes back exactly what approval added (022 FR-019), refused below what a bill has claimed. */
export async function reverseDwr(dwrId: string, reason: string): Promise<DwrActionResult> {
  return dwrActionSchema.parse(
    await authFetch<unknown>(`/projects/dwr/${dwrId}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  );
}

/** Correcting a draft, rather than deleting the day and entering it again (025 FR-026). */
export async function updateDwr(
  dwrId: string,
  input: Partial<CreateDwrInput>,
): Promise<DwrActionResult> {
  return dwrActionSchema.parse(
    await authFetch<unknown>(`/projects/dwr/${dwrId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

/**
 * Attaches evidence to a report (025 FR-025).
 *
 * **Base64 in JSON rather than `FormData`**, matching every other upload in this application. The
 * server detects the content type from the bytes rather than trusting the claim, and stores the
 * name as the uploader spelled it, so the download arrives named and openable.
 */
export async function addDwrAttachment(
  dwrId: string,
  file: File,
): Promise<DwrAttachment> {
  const data = await fileToBase64(file);
  return attachmentSchema.parse(
    await authFetch<unknown>(`/projects/dwr/${dwrId}/attachments`, {
      method: 'POST',
      body: JSON.stringify({ data, fileName: file.name }),
    }),
  );
}

/**
 * Flat, not nested under the report — an attachment id is unique on its own.
 *
 * `authFetchFile`, not the bare `apiFetchFile` this first shipped with: the raw client sends no
 * access token, so every download answered 401 and the screen reported only that the file could
 * not be opened. A download is an authenticated read like any other.
 */
export async function downloadDwrAttachment(
  attachmentId: string,
): Promise<StoredFile> {
  return authFetchFile(`/projects/dwr/attachments/${attachmentId}`);
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

const reconciliationSchema = z
  .object({
    lines: z.array(
      z
        .object({
          boqItemId: z.string(),
          boqNo: z.string(),
          doneQty: quantity,
          approvedSum: quantity,
          /** `doneQty − approvedSum`. Exactly 0 when the cache agrees with the record. */
          difference: quantity,
        })
        .passthrough(),
    ),
    discrepancies: z.number(),
  })
  .passthrough();

export type DwrReconciliation = z.infer<typeof reconciliationSchema>;

/**
 * Where the stored executed quantity disagrees with the sum of approved measurement (025 FR-027).
 *
 * At an **exact** tolerance — every increment is exact decimal, so any non-zero difference is a
 * defect rather than rounding. The approved sum is authoritative; the counter is a cache of it.
 */
export async function getReconciliation(
  projectId: string,
): Promise<DwrReconciliation> {
  return reconciliationSchema.parse(
    await authFetch<unknown>(`/projects/${projectId}/dwr/reconciliation`),
  );
}

/**
 * Sets a drifted counter back to the approved measurement.
 *
 * **Never automatic**, which is why this is a function a person calls rather than something the
 * report does on load: a discrepancy is the only symptom of whatever moved the counter without a
 * report, and a silent self-heal destroys that evidence every time it runs.
 */
export async function repairReconciliation(
  projectId: string,
  boqItemIds: string[],
  reason: string,
): Promise<{ repaired: { boqNo: string; from: string; to: string }[] }> {
  return authFetch(`/projects/${projectId}/dwr/reconciliation/repair`, {
    method: 'POST',
    body: JSON.stringify({ boqItemIds, reason }),
  });
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
  // `quantityInForce` first: the detail read reports the figure under that name, having already
  // chosen between the two bases server-side. The pair below is what a create response carries.
  if (line.quantityInForce != null) return line.quantityInForce;
  if (line.paymentMode === 'work_basis') return line.actualQty ?? null;
  return line.servedQty ?? null;
}

/**
 * How a measured quantity was arrived at, as label/value pairs ready to join with `×`.
 *
 * **All six, in the order the server multiplies them.** One screen listed four and omitted
 * `nos1`/`nos2`, so a line measured 2 × 6 × 2 × 1 displayed the 6, the 2 and the 1 and dropped the
 * ×2 — leaving a quantity that could not be checked against the factors printed beside it. Declared
 * here so a second screen cannot pick a different four.
 *
 * A factor the server reports as 1 is omitted: it is multiplicatively neutral and listing every
 * unused dimension buries the two that matter. Nothing at all means nothing was entered, which the
 * caller renders as such.
 */
export function factorsOf(line: DwrLine): [string, string][] {
  if (line.paymentMode !== 'work_basis') return [];
  return (
    [
      ['nos 1', line.nos1],
      ['nos 2', line.nos2],
      ['length', line.length],
      ['breadth', line.breadth],
      ['depth', line.depth],
      ['density', line.density],
    ] as const
  )
    .filter(([, v]) => v != null && Number(v) !== 1)
    .map(([label, v]) => [label, String(v)]);
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
  const keys = ['nos1', 'nos2', 'length', 'breadth', 'depth', 'density'];
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

/**
 * What to show a person when a daily-work call is refused.
 *
 * Here rather than in each screen because 423 is the one every DWR surface gets wrong: a locked
 * project refuses a write with a status that looks like a permission problem and is not, and a
 * screen that renders the bare message sends somebody to an administrator who cannot help them.
 */
export function describeDwrError(err: unknown): string {
  const anyErr = err as {
    status?: number;
    message?: string;
    details?: { message?: string };
  };
  if (anyErr?.status === 423) {
    return 'This project is locked, so nothing can be written to it. This is not a permission problem — the same person can write once it is unlocked.';
  }
  return (
    anyErr?.details?.message ??
    anyErr?.message ??
    'The report was refused and the server gave no reason.'
  );
}
