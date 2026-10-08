import { z } from 'zod';

import { authFetchBlob, authFetch } from '@/app/lib/session';

/**
 * Every bill-package call to `buildcore-api` — the routes under `projects/bill-packages` (feature 023, 024 FR-001).
 *
 * One module per domain, per Principle V; every response parsed by a zod schema before the app
 * trusts it, per Principle IV.
 *
 * ## Every figure here is already rendered, and nothing in this repository re-rounds it
 *
 * 024 FR-009, and it is the rule this module exists to hold. The API computes at full precision and
 * rounds **once**, to the rupee, at the point of display — settled not by preference but by the
 * client's own document, whose block A totals 21,73,189 while its two displayed taxes sum to
 * 21,73,190. Nine per cent of 18,41,686 is 1,65,751.74; each tax cell shows that rounded and the
 * total shows the rounding of the unrounded sum.
 *
 * So the money fields below are **strings, deliberately not coerced to numbers**, which is the one
 * place this module departs from `billing.ts`'s `decimal` convention. A number here would invite a
 * component to add two of them, and the sum would differ from the server's by a rupee in exactly
 * the places the client would notice.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

/** A figure the API has already rendered. Kept as sent — see this module's docblock. */
const rendered = z.union([z.number(), z.string()]).transform(String);
const nullableRendered = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => (v === null ? null : String(v)));

export const BILL_DIRECTIONS = ['to_client', 'to_subcontractor'] as const;
export type BillDirection = (typeof BILL_DIRECTIONS)[number];

export const BILL_PACKAGE_STATUSES = [
  'draft',
  'issued',
  'certified',
  'abandoned',
] as const;
export type BillPackageStatus = (typeof BILL_PACKAGE_STATUSES)[number];

export const CLAIM_PROPOSAL_SOURCES = [
  'approved_measurement',
  'no_measurement_source',
] as const;

export const CHECK_LIST_ANSWERS = ['yes', 'no', 'not_required'] as const;
export type CheckListAnswer = (typeof CHECK_LIST_ANSWERS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One proposed line.
 *
 * **`proposedQty` is nullable and null is not zero** (024 FR-005). Null means there was no
 * measurement to read — an award line mapped to no BOQ line, which the subcontract model permits
 * because a subcontract may itemise work differently. Zero means the measurement was read and was
 * nothing. The screens must never print the same thing for both: on the subcontractor direction
 * that would read as "no work was done this month" for every unmapped line of every bill.
 */
const claimSchema = z
  .object({
    id: z.string(),
    scheduleLineId: z.string(),
    boqNo: z.string(),
    description: z.string(),
    unit: z.string(),
    proposedQty: nullableRendered,
    proposalSource: z.enum(CLAIM_PROPOSAL_SOURCES),
    claimedQty: rendered,
    varianceQty: nullableRendered,
    reason: z.string().nullable(),
    overClaimed: z.boolean(),
    rate: rendered,
    amount: rendered,
    remainingQty: rendered,
    exceedsScope: z.boolean(),
    unpriced: z.boolean(),
  })
  .passthrough();

const ratesSchema = z
  .object({
    retentionFraction: rendered,
    cgstFraction: rendered,
    sgstFraction: rendered,
    igstFraction: rendered,
    tdsFraction: rendered,
  })
  .passthrough();

const packageSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    direction: z.enum(BILL_DIRECTIONS),
    label: z.string(),
    sequenceNo: z.number(),
    periodFrom: z.string(),
    periodTo: z.string(),
    status: z.enum(BILL_PACKAGE_STATUSES),
    rates: ratesSchema,
    claims: z.array(claimSchema),
    unpricedClaimedCount: z.number(),
    /**
     * The last approved daily report on the project — sent **only** when this package proposed
     * nothing at all, and null otherwise. Null together with an all-zero proposal is the other
     * answer: no work has ever been approved here.
     *
     * Optional as well as nullable, so a package read from an older server still parses.
     */
    latestApprovedWork: z
      .object({ workDate: z.string(), dprNumber: z.string() })
      .nullable()
      .optional(),
  })
  .passthrough();

export type BillPackage = z.infer<typeof packageSchema>;
export type BillPackageClaim = z.infer<typeof claimSchema>;

const packageListItemSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    direction: z.enum(BILL_DIRECTIONS),
    periodFrom: z.string(),
    periodTo: z.string(),
    status: z.enum(BILL_PACKAGE_STATUSES),
    issuedAt: z.string().nullable(),
    payable: rendered,
  })
  .passthrough();

export type BillPackageListItem = z.infer<typeof packageListItemSchema>;

const columnSchema = z.record(z.string(), rendered);

const abstractSchema = z
  .object({
    packageId: z.string(),
    label: z.string(),
    periodFrom: z.string(),
    periodTo: z.string(),
    taxBasis: z.string(),
    /** How the basis was decided — shown, because a tax decision nobody sees is one nobody made. */
    taxBasisSource: z.string(),
    /** True while the package is a draft: the cumulative column is not yet frozen (024 FR-008). */
    cumulativeProvisional: z.boolean(),
    rates: ratesSchema,
    columns: z.object({
      thisBill: columnSchema,
      uptoPrevious: columnSchema,
      uptoDate: columnSchema,
    }),
  })
  .passthrough();

export type BillAbstract = z.infer<typeof abstractSchema>;

const measurementSheetSchema = z
  .object({
    packageId: z.string(),
    billLabel: z.string(),
    scheduleLineId: z.string(),
    boqNo: z.string(),
    description: z.string(),
    unit: z.string(),
    history: z.array(
      z
        .object({
          billLabel: z.string(),
          periodFrom: z.string(),
          periodTo: z.string(),
          month: z.string(),
          quantity: rendered,
          reason: z.string().nullable(),
          overClaimed: z.boolean(),
          isThisBill: z.boolean(),
        })
        .passthrough(),
    ),
    dailyRecord: z.array(
      z
        .object({
          date: z.string(),
          /** True where no logbook entry exists — **not** a run of zeroes (022 FR-034). */
          logbookMissing: z.boolean(),
          openingReading: nullableRendered,
          closingReading: nullableRendered,
          totalHours: nullableRendered,
          remarks: z.string().nullable(),
        })
        .passthrough(),
    ),
    footer: z
      .object({
        thisBillQty: rendered,
        uptoPreviousQty: rendered,
        uptoDateQty: rendered,
        /** Which package the middle figure was read from, so a reviewer can go and check. */
        uptoPreviousFrom: z.string().nullable(),
      })
      .passthrough(),
  })
  .passthrough();

export type MeasurementSheet = z.infer<typeof measurementSheetSchema>;

const debitRowSchema = z
  .object({
    id: z.string(),
    /**
     * `PRPL-DN-0004`, allocated when the debit was raised (028 FR-019).
     *
     * **Null on every debit recorded before 028**, and rendered as an absence rather than as a
     * placeholder: those debits were never issued under a number, and printing one would name a
     * document nobody sent — the decision 027 made for work-order codes.
     */
    noteNumber: z.string().nullable().optional(),
    groupHeading: z.string().nullable(),
    description: z.string(),
    location: z.string().nullable(),
    nos: nullableRendered,
    length: nullableRendered,
    width: nullableRendered,
    quantity: nullableRendered,
    unit: z.string().nullable(),
    rate: rendered,
    amount: rendered,
    amountWithTax: rendered,
    recoveredOn: z.string().nullable(),
    recoveredOnPackageId: z.string().nullable(),
    recordedAt: z.string(),
  })
  .passthrough();

const registerSchema = z
  .object({
    packageId: z.string(),
    /** True where the bill is issued: this is the register **as at issue** (023 FR-039a). */
    asAtIssue: z.boolean(),
    groups: z.array(
      z
        .object({
          heading: z.string().nullable(),
          rows: z.array(debitRowSchema),
        })
        .passthrough(),
    ),
    recoveredOnThisPackage: rendered,
    total: rendered,
  })
  .passthrough();

export type DebitRegister = z.infer<typeof registerSchema>;
export type DebitRow = z.infer<typeof debitRowSchema>;

const checkListSchema = z
  .object({
    items: z.array(
      z
        .object({
          key: z.string(),
          position: z.number(),
          text: z.string(),
          /** **Null is unanswered, which is not an answer of no** (023 FR-042, 024 FR-011). */
          answer: z.enum(CHECK_LIST_ANSWERS).nullable(),
          answeredAt: z.string().nullable(),
        })
        .passthrough(),
    ),
    gaps: z.array(
      z
        .object({
          position: z.number(),
          key: z.string(),
          text: z.string(),
          state: z.enum(['unanswered', 'no']),
        })
        .passthrough(),
    ),
    footer: z.string(),
    signatories: z.array(z.string()),
  })
  .passthrough();

export type CheckList = z.infer<typeof checkListSchema>;

const issueResultSchema = z
  .object({
    package: packageSchema,
    /** Reported, never a refusal (023 FR-027, FR-027a). */
    missingHeaderFields: z.array(z.string()),
    checkListGaps: z.array(
      z
        .object({
          position: z.number(),
          key: z.string(),
          text: z.string(),
          state: z.enum(['unanswered', 'no']),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export type IssueResult = z.infer<typeof issueResultSchema>;

const understatementSchema = z
  .object({
    projectId: z.string(),
    rows: z.array(
      z
        .object({
          packageId: z.string(),
          label: z.string(),
          periodFrom: z.string(),
          periodTo: z.string(),
          lines: z.array(
            z
              .object({
                boqItemId: z.string(),
                boqNo: z.string(),
                claimed: rendered,
                approvedNow: rendered,
                understatedBy: rendered,
              })
              .passthrough(),
          ),
          /** What to do about it — the report alone is not a remedy (023 FR-014c). */
          remedy: z.string(),
        })
        .passthrough(),
    ),
    comparableDirections: z.array(z.string()),
  })
  .passthrough();

export type UnderstatementReport = z.infer<typeof understatementSchema>;

const overClaimSchema = z
  .object({
    projectId: z.string(),
    rows: z.array(
      z
        .object({
          packageId: z.string(),
          label: z.string(),
          status: z.string(),
          overClaimedCount: z.number(),
          /** The denominator, without which a count cannot be read as a pattern (023 FR-006b). */
          lineCount: z.number(),
          lines: z.array(
            z
              .object({
                boqNo: z.string(),
                claimed: rendered,
                proposed: nullableRendered,
                reason: z.string().nullable(),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
    totalOverClaimed: z.number(),
    totalLines: z.number(),
  })
  .passthrough();

export type OverClaimReport = z.infer<typeof overClaimSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Calls
// ─────────────────────────────────────────────────────────────────────────────

export interface ComposeInput {
  direction: BillDirection;
  periodFrom: string;
  periodTo: string;
  workOrderId?: string;
  externalBillNo?: string;
  externalWorkOrderNo?: string;
}

export async function listBillPackages(
  projectId: string,
): Promise<BillPackageListItem[]> {
  const raw = await authFetch<unknown>(`/projects/${projectId}/bill-packages`);
  return z.array(packageListItemSchema).parse(raw);
}

export async function getBillPackage(packageId: string): Promise<BillPackage> {
  return packageSchema.parse(
    await authFetch<unknown>(`/projects/bill-packages/${packageId}`),
  );
}

/**
 * Opens a package for a period.
 *
 * The same project, direction and period opened twice returns the **existing** package rather than
 * creating a second — so this is safe to call again, and the screen shows what came back rather
 * than assuming it made something new.
 */
export async function composeBillPackage(
  projectId: string,
  input: ComposeInput,
): Promise<BillPackage> {
  return packageSchema.parse(
    await authFetch<unknown>(`/projects/${projectId}/bill-packages`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

/**
 * Sets one line's claimed quantity.
 *
 * A reduction and an over-claim both need a reason; returning the claim to its proposal **clears**
 * the reason, which the API does rather than the form — a reason beside a zero variance argues on
 * the measurement sheet for a deduction the bill does not make.
 */
export async function setClaim(
  packageId: string,
  claimId: string,
  input: { claimedQty: string; reason?: string },
): Promise<BillPackage> {
  return packageSchema.parse(
    await authFetch<unknown>(
      `/projects/bill-packages/${packageId}/lines/${claimId}`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
  );
}

/**
 * The fields a bill's recoveries and deductions are entered through (025 FR-044).
 *
 * Declared here rather than in the form so the screen and the request cannot name different
 * columns — every one of these was printed on the bill and settable nowhere until now.
 */
export const BILL_ADJUSTMENTS = [
  { key: 'releaseWithheld', label: 'Release of withheld amount', block: 'A' },
  { key: 'recoveryDiesel', label: 'Recovery of diesel', block: 'B' },
  { key: 'debitAgainstCivil', label: 'Debit against civil', block: 'B' },
  { key: 'otherRecoveries', label: 'Other recoveries', block: 'B' },
  { key: 'mechanicalDebit', label: 'Mechanical debit', block: 'B' },
  { key: 'mobilizationAdvance', label: 'Mobilisation advance', block: 'C' },
  { key: 'performanceSecurity', label: 'Performance security', block: 'C' },
  {
    key: 'theftWithheld',
    label: 'Amount withheld for theft items (incl. GST)',
    block: 'C',
  },
] as const;

/** The two one-time recoveries' contract totals, which make "fully recovered" a fact. */
export const BILL_ADJUSTMENT_TOTALS = [
  { key: 'mobilizationAdvanceTotal', of: 'mobilizationAdvance' },
  { key: 'performanceSecurityTotal', of: 'performanceSecurity' },
] as const;

export type BillAdjustmentKey =
  | (typeof BILL_ADJUSTMENTS)[number]['key']
  | (typeof BILL_ADJUSTMENT_TOTALS)[number]['key'];

/**
 * Sets the month's entered figures. **Draft only** — issue freezes them.
 *
 * Only the keys passed are written; a column left out is unchanged, and `'0'` sets it to zero. The
 * form posts just what the person edited for that reason.
 */
export async function setBillAdjustments(
  packageId: string,
  input: Partial<Record<BillAdjustmentKey, string>>,
): Promise<BillPackage> {
  return packageSchema.parse(
    await authFetch<unknown>(
      `/projects/bill-packages/${packageId}/adjustments`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
  );
}

export async function abandonBillPackage(packageId: string): Promise<void> {
  await authFetch<unknown>(`/projects/bill-packages/${packageId}/abandon`, {
    method: 'POST',
  });
}

export async function getAbstract(packageId: string): Promise<BillAbstract> {
  return abstractSchema.parse(
    await authFetch<unknown>(`/projects/bill-packages/${packageId}/abstract`),
  );
}

export async function getMeasurementSheet(
  packageId: string,
  scheduleLineId: string,
): Promise<MeasurementSheet> {
  return measurementSheetSchema.parse(
    await authFetch<unknown>(
      `/projects/bill-packages/${packageId}/measurement/${scheduleLineId}`,
    ),
  );
}

export async function getDebitRegister(
  packageId: string,
): Promise<DebitRegister> {
  return registerSchema.parse(
    await authFetch<unknown>(`/projects/bill-packages/${packageId}/debits`),
  );
}

export interface RecordDebitInput {
  groupHeading?: string;
  description: string;
  location?: string;
  nos?: string;
  length?: string;
  width?: string;
  quantity?: string;
  unit?: string;
  rate: string;
  amount: string;
  amountWithTax: string;
}

export async function recordDebit(
  projectId: string,
  input: RecordDebitInput,
): Promise<DebitRow> {
  return debitRowSchema.parse(
    await authFetch<unknown>(`/projects/${projectId}/bill-package-debits`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

/** A debit is recovered on exactly one bill, and only a draft accepts one (023 FR-037, FR-037b). */
export async function applyDebit(
  debitId: string,
  packageId: string,
): Promise<DebitRow> {
  return debitRowSchema.parse(
    await authFetch<unknown>(
      `/projects/bill-package-debits/${debitId}/apply/${packageId}`,
      { method: 'POST' },
    ),
  );
}

export async function getCheckList(packageId: string): Promise<CheckList> {
  return checkListSchema.parse(
    await authFetch<unknown>(`/projects/bill-packages/${packageId}/check-list`),
  );
}

export async function setCheckList(
  packageId: string,
  answers: { questionKey: string; answer?: CheckListAnswer }[],
): Promise<CheckList> {
  return checkListSchema.parse(
    await authFetch<unknown>(
      `/projects/bill-packages/${packageId}/check-list`,
      { method: 'POST', body: JSON.stringify({ answers }) },
    ),
  );
}

export async function issueBillPackage(
  packageId: string,
): Promise<IssueResult> {
  return issueResultSchema.parse(
    await authFetch<unknown>(`/projects/bill-packages/${packageId}/issue`, {
      method: 'POST',
    }),
  );
}

export async function reviseBillPackage(
  packageId: string,
  reason: string,
): Promise<BillPackage> {
  return packageSchema.parse(
    await authFetch<unknown>(`/projects/bill-packages/${packageId}/revise`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  );
}

export async function certifyBillPackage(
  packageId: string,
  certifiedAmount: string,
): Promise<BillPackage> {
  return packageSchema.parse(
    await authFetch<unknown>(`/projects/bill-packages/${packageId}/certify`, {
      method: 'POST',
      body: JSON.stringify({ certifiedAmount }),
    }),
  );
}

/**
 * The 24-sheet workbook (024 FR-012).
 *
 * Returned as a blob with the name the server gave it. The server also names any party identifier
 * it could not fill in the `X-Bill-Package-Missing-Fields` header — a workbook is a file download,
 * so a list in a response body is a list nobody sees. `fetch` exposes response headers, which is
 * why the filename and the gaps both come from the server rather than being guessed here.
 */
export async function downloadWorkbook(
  packageId: string,
  label: string,
): Promise<{ blob: Blob; filename: string }> {
  const blob = await authFetchBlob(
    `/projects/bill-packages/${packageId}/workbook.xlsx`,
  );
  return { blob, filename: `${label}.xlsx` };
}

/**
 * The same bill as a PDF (025 FR-042).
 *
 * The `.xlsx` is what a client edits before signing; this is what gets attached to an email and
 * filed — a form nobody can alter after it was sent. Both are rendered from the same stored
 * figures, so the two cannot disagree.
 */
export async function downloadBillPdf(
  packageId: string,
  label: string,
): Promise<{ blob: Blob; filename: string }> {
  const blob = await authFetchBlob(
    `/projects/bill-packages/${packageId}/bill.pdf`,
  );
  return { blob, filename: `${label}.pdf` };
}

export async function getUnderstatementReport(
  projectId: string,
): Promise<UnderstatementReport> {
  return understatementSchema.parse(
    await authFetch<unknown>(
      `/projects/${projectId}/bill-packages/reports/understatement`,
    ),
  );
}

export async function getOverClaimReport(
  projectId: string,
): Promise<OverClaimReport> {
  return overClaimSchema.parse(
    await authFetch<unknown>(
      `/projects/${projectId}/bill-packages/reports/over-claims`,
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How a proposed quantity reads (024 FR-005, SC-004).
 *
 * **The one place that decides**, so no component can collapse the two kinds of empty. A null
 * proposal is *no measurement*; a zero is a measurement that read nothing. They call for different
 * actions — the first means look at the subcontract's mapping, the second means nothing was done —
 * and they are a single `??` away from being indistinguishable.
 */
export function proposalLabel(claim: BillPackageClaim): string {
  if (claim.proposalSource === 'no_measurement_source' || claim.proposedQty === null) {
    return 'no measurement';
  }
  return claim.proposedQty;
}

/** Whether a claim can still be edited. An issued bill is a document that was sent. */
export function isEditable(status: BillPackageStatus): boolean {
  return status === 'draft';
}

/** The abstract's rows, in the client's own order, with the labels their sheet uses. */
export const ABSTRACT_BLOCKS: {
  title: string;
  rows: { key: string; label: string; isTotal?: boolean }[];
}[] = [
  {
    title: 'A. Work',
    rows: [
      { key: 'workDone', label: 'Work done amount' },
      { key: 'releaseWithheld', label: 'Release withheld amount' },
      { key: 'cgstAmount', label: 'CGST' },
      { key: 'sgstAmount', label: 'SGST' },
      { key: 'igstAmount', label: 'IGST' },
      { key: 'workTotal', label: 'Total amount (A)', isTotal: true },
    ],
  },
  {
    title: 'B. Recoveries',
    rows: [
      { key: 'recoveryDiesel', label: 'Recovery of diesel' },
      { key: 'debitAgainstCivil', label: 'Debit against civil' },
      { key: 'otherRecoveries', label: 'Other recoveries' },
      { key: 'mechanicalDebit', label: 'Mechanical debit — as per enclosure' },
      { key: 'recoveriesTotal', label: 'Total recoveries (B)', isTotal: true },
    ],
  },
  {
    title: 'C. Deductions',
    rows: [
      { key: 'mobilizationAdvance', label: 'Deduction for mobilisation advance' },
      { key: 'retentionAmount', label: 'Retention money' },
      { key: 'performanceSecurity', label: 'Performance security' },
      { key: 'theftWithheld', label: 'Amount withheld for theft items (incl. GST)' },
      { key: 'deductionsTotal', label: 'Total deductions (C)', isTotal: true },
    ],
  },
  {
    title: 'D. Tax deductions',
    rows: [
      { key: 'tdsAmount', label: 'Income tax TDS' },
      { key: 'taxDeductionsTotal', label: 'Total (D)', isTotal: true },
    ],
  },
];
