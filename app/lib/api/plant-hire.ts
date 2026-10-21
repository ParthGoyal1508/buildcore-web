import { z } from 'zod';

import {
  hireBillSchema,
  maintenanceJobSchema,
  type MaintenanceJob,
} from '@/app/lib/api/plant';
import type { StoredFile } from '@/app/lib/api/client';
import { authFetch, authFetchFile } from '@/app/lib/session';

/**
 * The client's own plant documents (2026-10-15): vehicle work/hire orders, the vehicle
 * hiring bill's extra fields, and the maintenance job card.
 *
 * Kept apart from `plant.ts` so the three formats can move without touching the module the
 * register and logbook screens depend on. The hire-bill schema here *extends* that module's
 * rather than replacing it, so the existing verify/pay calls keep parsing what they did.
 *
 * Every schema was checked against a response the running API returned, as `plant.ts`'s
 * header asks.
 */

const decimal = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : Number(v)))
  .refine((v) => !Number.isNaN(v), { message: 'Not a number' });

const nullableDecimal = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => (v === null ? null : typeof v === 'number' ? v : Number(v)))
  .refine((v) => v === null || !Number.isNaN(v), { message: 'Not a number' });

function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export type DocumentFormat = 'pdf' | 'docx' | 'xlsx';

/** The three downloads every format here offers, under the server's own file name. */
async function documentFile(path: string, fallbackName: string) {
  const { blob, filename } = await authFetchFile(path);
  return { blob, filename: filename ?? fallbackName };
}

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle work/hire orders
// ─────────────────────────────────────────────────────────────────────────────

export const hireOrderLineSchema = z.object({
  id: z.string(),
  position: z.number(),
  equipmentId: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  sacCode: z.string().nullable(),
  taxRate: decimal,
  quantity: decimal,
  uom: z.string(),
  rate: decimal,
  amount: decimal,
});

export const hireOrderSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  /** From the company's work-order series, assigned on save. */
  code: z.string(),
  referenceNo: z.string().nullable(),
  date: z.string(),
  vendorId: z.string(),
  vendorName: z.string(),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  pointOfDelivery: z.string().nullable(),
  remarks: z.string().nullable(),
  lines: z.array(hireOrderLineSchema),
  taxableAmount: decimal,
  taxAmount: decimal,
  totalAmount: decimal,
  createdAt: z.string(),
});
export type HireOrder = z.infer<typeof hireOrderSchema>;

export interface HireOrderLineInput {
  title: string;
  description: string;
  sacCode?: string;
  taxRate?: number;
  quantity: number;
  uom: string;
  rate: number;
  equipmentId?: string;
}

export interface HireOrderInput {
  date: string;
  referenceNo?: string;
  vendorId: string;
  /** An empty string on an edit clears it; the server reads `''` as "none". */
  projectId?: string;
  pointOfDelivery?: string;
  remarks?: string;
  lines: HireOrderLineInput[];
}

export async function getHireOrders(
  query: { companyId?: string; vendorId?: string; projectId?: string } = {},
): Promise<HireOrder[]> {
  const raw = await authFetch<unknown>(`/plant/hire-orders${qs(query)}`);
  return z.array(hireOrderSchema).parse(raw);
}

export const hireOrderPageSchema = z.object({
  items: z.array(hireOrderSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type HireOrderPage = z.infer<typeof hireOrderPageSchema>;

/**
 * One page of orders (036 K17). The unpaged `getHireOrders` above is silently capped at 200 by
 * the API; the list screen pages instead.
 */
export async function getHireOrdersPage(
  query: {
    companyId?: string;
    vendorId?: string;
    projectId?: string;
    page: number;
    pageSize?: number;
  },
): Promise<HireOrderPage> {
  const raw = await authFetch<unknown>(`/plant/hire-orders${qs(query)}`);
  return hireOrderPageSchema.parse(raw);
}

/** One order, for its own page (2026-10-15). */
export async function getHireOrder(id: string): Promise<HireOrder> {
  const raw = await authFetch<unknown>(`/plant/hire-orders/${id}`);
  return hireOrderSchema.parse(raw);
}

export async function createHireOrder(
  input: HireOrderInput,
  companyId?: string | null,
): Promise<HireOrder> {
  const raw = await authFetch<unknown>(
    `/plant/hire-orders${qs({ companyId })}`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return hireOrderSchema.parse(raw);
}

export async function updateHireOrder(
  id: string,
  input: Partial<HireOrderInput>,
): Promise<HireOrder> {
  const raw = await authFetch<unknown>(`/plant/hire-orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return hireOrderSchema.parse(raw);
}

/** Refused with a 400 once a hire bill has been raised against the order. */
export async function deleteHireOrder(id: string): Promise<void> {
  await authFetch<void>(`/plant/hire-orders/${id}`, { method: 'DELETE' });
}

export function downloadHireOrder(order: HireOrder, format: DocumentFormat) {
  return documentFile(
    `/plant/hire-orders/${order.id}/document.${format}`,
    `Work Order ${order.code}.${format}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vehicle hiring bill — the fields the client's format added
// ─────────────────────────────────────────────────────────────────────────────

export const HIRE_BILL_BASES = ['hours', 'monthly'] as const;
export type HireBillBasis = (typeof HIRE_BILL_BASES)[number];

export const hireBillFullSchema = hireBillSchema.extend({
  basis: z.enum(HIRE_BILL_BASES),
  meterType: z.string(),
  registrationNo: z.string().nullable(),
  hireOrderId: z.string().nullable(),
  hireOrderCode: z.string().nullable(),
  billDate: z.string().nullable(),
  invoiceNo: z.string().nullable(),
  taxInvoiceRef: z.string().nullable(),
  taxInvoiceDate: z.string().nullable(),
  description: z.string().nullable(),
  periodDays: z.number().nullable(),
  monthlyRate: nullableDecimal,
  agreedAverage: nullableDecimal,
  startReading: nullableDecimal,
  endReading: nullableDecimal,
  dieselGiven: nullableDecimal,
  actualDiesel: nullableDecimal,
  deductionAmount: nullableDecimal,
  holdAmount: nullableDecimal,
  fuelRecoveryTotal: nullableDecimal,
});
export type HireBillFull = z.infer<typeof hireBillFullSchema>;

export const hireBillFullPageSchema = z.object({
  items: z.array(hireBillFullSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  pendingVerificationCount: z.number(),
  unpaidTotal: decimal,
});
export type HireBillFullPage = z.infer<typeof hireBillFullPageSchema>;

export async function getHireBillsFull(
  query: Record<string, string | number | undefined> = {},
): Promise<HireBillFullPage> {
  const raw = await authFetch<unknown>(`/plant/hire-bills${qs(query)}`);
  return hireBillFullPageSchema.parse(raw);
}

export interface HireBillCreateInput {
  equipmentId: string;
  vendorId: string;
  basis: HireBillBasis;
  billingPeriodFrom: string;
  billingPeriodTo: string;
  /** Required by hours; on a monthly bill it defaults to the run between readings. */
  billedHours?: number;
  rate?: number;
  monthlyRate?: number;
  periodDays?: number;
  hireOrderId?: string;
  billDate?: string;
  invoiceNo?: string;
  taxInvoiceRef?: string;
  taxInvoiceDate?: string;
  description?: string;
  agreedAverage?: number;
  startReading?: number;
  endReading?: number;
  deductionAmount?: number;
  holdAmount?: number;
}

export async function createHireBillFull(
  input: HireBillCreateInput,
): Promise<HireBillFull> {
  const raw = await authFetch<unknown>('/plant/hire-bills', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return hireBillFullSchema.parse(raw);
}

/** Only while the bill is still pending verification; the server recomputes the row. */
export interface HireBillCorrection {
  billDate?: string;
  invoiceNo?: string;
  taxInvoiceRef?: string;
  taxInvoiceDate?: string;
  description?: string;
  agreedAverage?: number;
  deductionAmount?: number;
  holdAmount?: number;
}

export async function updateHireBill(
  id: string,
  input: HireBillCorrection,
): Promise<HireBillFull> {
  const raw = await authFetch<unknown>(`/plant/hire-bills/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return hireBillFullSchema.parse(raw);
}

export function downloadHireBill(bill: HireBillFull, format: DocumentFormat) {
  return documentFile(
    `/plant/hire-bills/${bill.id}/document.${format}`,
    `Vehicle Hiring Bill ${bill.equipmentCode}.${format}`.replace(/\//g, '-'),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance job card
// ─────────────────────────────────────────────────────────────────────────────

export const JOB_CARD_PRIORITIES = ['Breakdown', 'Urgent', 'Routine'] as const;
export const JOB_CARD_TYPES = [
  'Preventive',
  'Corrective',
  'Inspection',
] as const;
export const JOB_CARD_CONDITIONS = [
  'Running',
  'Not Running',
  'Unsafe to Operate',
] as const;
export const JOB_CARD_CHECKS = [
  'Visual inspection',
  'Fluid / oil levels',
  'Leaks',
  'Brakes / steering',
  'Electrical',
  'Guards / safety devices',
  'Trial run / road test',
] as const;
export const JOB_CARD_RESULTS = [
  'Satisfactory',
  'Further repair required',
  'Not tested',
] as const;
export const JOB_CARD_STATUSES = [
  'Fit for use',
  'Fit with restrictions',
  'Out of service',
] as const;

const optionalText = z.string().nullish();
const optionalNumber = nullableDecimal.optional();

export const jobCardSchema = z.object({
  date: optionalText,
  priority: optionalText,
  jobType: optionalText,
  department: optionalText,
  requestedBy: optionalText,
  location: optionalText,
  contact: optionalText,
  machineName: optionalText,
  assetNo: optionalText,
  registrationNo: optionalText,
  makeModel: optionalText,
  meterReading: optionalText,
  fuelLevel: optionalText,
  operator: optionalText,
  remarks: optionalText,
  complaint: optionalText,
  machineCondition: optionalText,
  breakdownStart: optionalText,
  reportedTo: optionalText,
  inspections: z
    .array(
      z.object({
        fault: optionalText,
        action: optionalText,
        quotationAmount: optionalNumber,
        startTime: optionalText,
        finishTime: optionalText,
      }),
    )
    .nullish(),
  parts: z
    .array(
      z.object({
        description: optionalText,
        partNo: optionalText,
        quantity: optionalNumber,
        unit: optionalText,
        rate: optionalNumber,
      }),
    )
    .nullish(),
  checks: z.array(z.string()).nullish(),
  testResult: optionalText,
  outstandingWork: optionalText,
  machineStatus: optionalText,
  downTimeHours: optionalNumber,
  nextServiceDate: optionalText,
  nextServiceReading: optionalText,
  signOff: z
    .object({
      operator: optionalText,
      technician: optionalText,
      supervisor: optionalText,
      incharge: optionalText,
    })
    .nullish(),
});
export type JobCardRead = z.infer<typeof jobCardSchema>;

/** What the API accepts: every field optional, and no enum sent as an empty string. */
export interface JobCard {
  date?: string;
  priority?: string;
  jobType?: string;
  department?: string;
  requestedBy?: string;
  location?: string;
  contact?: string;
  machineName?: string;
  assetNo?: string;
  registrationNo?: string;
  makeModel?: string;
  meterReading?: string;
  fuelLevel?: string;
  operator?: string;
  remarks?: string;
  complaint?: string;
  machineCondition?: string;
  breakdownStart?: string;
  reportedTo?: string;
  inspections?: {
    fault?: string;
    action?: string;
    quotationAmount?: number;
    startTime?: string;
    finishTime?: string;
  }[];
  parts?: {
    description?: string;
    partNo?: string;
    quantity?: number;
    unit?: string;
    rate?: number;
  }[];
  checks?: string[];
  testResult?: string;
  outstandingWork?: string;
  machineStatus?: string;
  downTimeHours?: number;
  nextServiceDate?: string;
  nextServiceReading?: string;
  signOff?: {
    operator?: string;
    technician?: string;
    supervisor?: string;
    incharge?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Job card workflow (039): quotation → Head Office approval → final bill → payment
// ─────────────────────────────────────────────────────────────────────────────

export const JOB_CARD_FLOW_STATUSES = [
  'draft',
  'pending_approval',
  'returned',
  'approved',
  'bill_uploaded',
  'paid',
] as const;
export type JobCardFlowStatus = (typeof JOB_CARD_FLOW_STATUSES)[number];

/** The client's words for each stage. `returned` is "Sent for Correction". */
export const JOB_CARD_FLOW_LABELS: Record<JobCardFlowStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  returned: 'Sent for Correction',
  approved: 'Approved',
  bill_uploaded: 'Final Bill Uploaded',
  paid: 'Paid',
};

/** Site may change the card only while it is a draft or sent back for correction. */
export const isJobCardEditable = (status: JobCardFlowStatus | null | undefined) =>
  !status || status === 'draft' || status === 'returned';

export const JOB_CARD_PAYMENT_MODES = ['bank_transfer', 'cheque', 'upi', 'cash'] as const;
export type JobCardPaymentMode = (typeof JOB_CARD_PAYMENT_MODES)[number];
export const JOB_CARD_PAYMENT_MODE_LABELS: Record<JobCardPaymentMode, string> = {
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  upi: 'UPI',
  cash: 'Cash',
};

export const jobCardWorkflowSchema = z.object({
  status: z.enum(JOB_CARD_FLOW_STATUSES),
  returnRemarks: z.string().nullable(),
  quotation: z.object({
    amount: nullableDecimal,
    fileName: z.string().nullable(),
    hasFile: z.boolean(),
  }),
  finalBill: z
    .object({
      billNumber: z.string().nullable(),
      billDate: z.string().nullable(),
      amount: nullableDecimal,
      fileName: z.string().nullable(),
      uploadedAt: z.string().nullable(),
      uploadedByName: z.string().nullable(),
    })
    .nullable(),
  paidTotal: decimal,
  balance: nullableDecimal,
});
export type JobCardWorkflow = z.infer<typeof jobCardWorkflowSchema>;

export const jobCardViewSchema = z.object({
  jobId: z.string().nullable(),
  jobCardNo: z.string().nullable(),
  equipmentId: z.string(),
  projectHeading: z.string().nullable(),
  card: jobCardSchema,
  /** Parts drawn from the spare-parts store against the job — read-only on the card. */
  storeParts: z.array(
    z.object({
      description: z.string(),
      partNo: z.string().nullable().optional(),
      quantity: decimal,
      unit: z.string().nullable().optional(),
      rate: decimal,
      amount: decimal,
    }),
  ),
  /** Null on a card not yet saved. Optional so an older API's response still parses. */
  workflow: jobCardWorkflowSchema.nullable().optional(),
});
export type JobCardView = z.infer<typeof jobCardViewSchema>;

/** Section 1 filled from the machine, for a card not yet saved. */
export async function getJobCardPrefill(
  equipmentId: string,
): Promise<JobCardView> {
  const raw = await authFetch<unknown>(
    `/plant/maintenance/job-card/prefill${qs({ equipmentId })}`,
  );
  return jobCardViewSchema.parse(raw);
}

export async function getJobCard(jobId: string): Promise<JobCardView> {
  const raw = await authFetch<unknown>(`/plant/maintenance/${jobId}/job-card`);
  return jobCardViewSchema.parse(raw);
}

/** Numbered JC-0001… the first time a job's card is saved. */
export async function saveJobCard(
  jobId: string,
  card: JobCard,
): Promise<JobCardView> {
  const raw = await authFetch<unknown>(`/plant/maintenance/${jobId}/job-card`, {
    method: 'PUT',
    body: JSON.stringify(card),
  });
  return jobCardViewSchema.parse(raw);
}

/** Opens the job (the machine goes under maintenance; 409 if it already has an open one)
 * and saves and numbers its card in the same call. */
export async function createJobWithCard(input: {
  equipmentId: string;
  type: 'breakdown' | 'scheduled';
  description: string;
  linkedServiceScheduleId?: string;
  card: JobCard;
}): Promise<MaintenanceJob> {
  const raw = await authFetch<unknown>('/plant/maintenance', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return maintenanceJobSchema.parse(raw);
}

export function downloadJobCard(
  jobId: string,
  jobCardNo: string | null,
  format: DocumentFormat,
) {
  return documentFile(
    `/plant/maintenance/${jobId}/job-card.${format}`,
    `Job Card ${jobCardNo ?? jobId}.${format}`,
  );
}

/** Sets the quotation amount; `file` (base64) uploads or replaces the quotation itself. */
export async function saveJobCardQuotation(
  jobId: string,
  input: { amount: number; file?: string; fileName?: string },
): Promise<void> {
  await authFetch<unknown>(`/plant/maintenance/${jobId}/job-card/quotation`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

/** Sends the card to Head Office, or resubmits it after correction. */
export async function submitJobCard(jobId: string): Promise<void> {
  await authFetch<unknown>(`/plant/maintenance/${jobId}/job-card/submit`, {
    method: 'POST',
  });
}

export async function uploadJobCardFinalBill(
  jobId: string,
  input: {
    billNumber: string;
    billDate: string;
    amount: number;
    file: string;
    fileName?: string;
  },
): Promise<void> {
  await authFetch<unknown>(`/plant/maintenance/${jobId}/job-card/final-bill`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export const jobCardPaymentSchema = z.object({
  id: z.string(),
  amount: decimal,
  paidOn: z.string(),
  mode: z.enum(JOB_CARD_PAYMENT_MODES),
  referenceNumber: z.string().nullable(),
  remarks: z.string().nullable(),
  proofFileName: z.string().nullable(),
  hasProof: z.boolean(),
  recordedByName: z.string().nullable(),
  createdAt: z.string(),
});
export type JobCardPayment = z.infer<typeof jobCardPaymentSchema>;

export const jobCardPaymentsSchema = z.object({
  status: z.enum(JOB_CARD_FLOW_STATUSES).nullable(),
  billAmount: nullableDecimal,
  paidTotal: decimal,
  balance: nullableDecimal,
  payments: z.array(jobCardPaymentSchema),
});
export type JobCardPayments = z.infer<typeof jobCardPaymentsSchema>;

export async function getJobCardPayments(jobId: string): Promise<JobCardPayments> {
  const raw = await authFetch<unknown>(`/plant/maintenance/${jobId}/job-card/payments`);
  return jobCardPaymentsSchema.parse(raw);
}

export async function recordJobCardPayment(
  jobId: string,
  input: {
    amount: number;
    paidOn: string;
    mode: JobCardPaymentMode;
    referenceNumber?: string;
    remarks?: string;
    proofFile?: string;
    proofFileName?: string;
  },
): Promise<void> {
  await authFetch<unknown>(`/plant/maintenance/${jobId}/job-card/payments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export const jobCardEventSchema = z.object({
  id: z.string(),
  kind: z.string(),
  fromStatus: z.enum(JOB_CARD_FLOW_STATUSES).nullable(),
  toStatus: z.enum(JOB_CARD_FLOW_STATUSES).nullable(),
  remarks: z.string().nullable(),
  detail: z.record(z.string(), z.unknown()).nullable(),
  actorName: z.string().nullable(),
  at: z.string(),
});
export type JobCardEvent = z.infer<typeof jobCardEventSchema>;

export async function getJobCardHistory(jobId: string): Promise<JobCardEvent[]> {
  const raw = await authFetch<unknown>(`/plant/maintenance/${jobId}/job-card/history`);
  return z.array(jobCardEventSchema).parse(raw);
}

export function getJobCardQuotationFile(jobId: string): Promise<StoredFile> {
  return authFetchFile(`/plant/maintenance/${jobId}/job-card/quotation/file`);
}

export function getJobCardFinalBillFile(jobId: string): Promise<StoredFile> {
  return authFetchFile(`/plant/maintenance/${jobId}/job-card/final-bill/file`);
}

export function getJobCardPaymentProof(jobId: string, paymentId: string): Promise<StoredFile> {
  return authFetchFile(
    `/plant/maintenance/${jobId}/job-card/payments/${paymentId}/proof`,
  );
}
