import { z } from 'zod';

import {
  ADVANCE_STATUSES,
  ATTENDANCE_TYPES,
  ENGAGEMENT_TYPES,
  LABOUR_PAYMENT_MODES,
  MUSTER_STATUSES,
  PAYMENT_SHEET_LINE_STATUSES,
  LABOUR_GENDERS,
  PAYMENT_SHEET_STATUSES,
  RATE_SOURCES,
} from '@/app/lib/constants';
import { authFetch, authFetchFile } from '@/app/lib/session';
import { amountHidden, hideableDecimal } from './cash-hiding';

/**
 * Every `/labour/*` and `/settings/skill-categories` call to `buildcore-api`
 * (feature 013).
 *
 * One module per domain, per Constitution Principle V — no component issues its own
 * `fetch()`. Every response is parsed through a `zod` schema before the app trusts
 * it (Principle IV), and the `z.infer` type is what the UI consumes. Schemas validate
 * the fields the UI reads and let `zod` strip the rest — the same choice
 * `partners.ts` and `projects.ts` document.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

const decimal = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v : v.trim() === '' ? NaN : Number(v)))
  .refine((v) => !Number.isNaN(v), { message: 'Not a number' });

const nullableDecimal = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) =>
    v === null ? null : typeof v === 'number' ? v : v.trim() === '' ? null : Number(v),
  )
  .refine((v) => v === null || !Number.isNaN(v), { message: 'Not a number' });

/** A name the API added beside an id (036 O8). Tolerant, so an older API that omits it still parses. */
const optionalName = z.string().nullable().optional().catch(null).transform((v) => v ?? null);

function qs(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/** Reads a Blob as a base64 data URL — the shape the muster/enrolment/acknowledgement
 * endpoints accept, matching how the punch and face-enrol flows post photos. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill categories (US1)
// ─────────────────────────────────────────────────────────────────────────────

const skillCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  defaultDailyRate: nullableDecimal,
  isActive: z.boolean(),
});
export type SkillCategory = z.infer<typeof skillCategorySchema>;

export async function getSkillCategories(
  companyId?: string,
): Promise<SkillCategory[]> {
  const data = await authFetch<unknown>(
    `/settings/skill-categories${qs({ companyId })}`,
  );
  return z.array(skillCategorySchema).parse(data);
}

export interface SkillCategoryInput {
  /** Required of a cross-company caller, who has no company of their own to fall
   *  back on — the backend answers 400 without it. */
  companyId?: string;
  name: string;
  code: string;
  defaultDailyRate?: number;
}

export async function createSkillCategory(
  input: SkillCategoryInput,
): Promise<SkillCategory> {
  const data = await authFetch<unknown>('/settings/skill-categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return skillCategorySchema.parse(data);
}

export async function updateSkillCategory(
  id: string,
  input: Partial<SkillCategoryInput> & { isActive?: boolean },
): Promise<SkillCategory> {
  const data = await authFetch<unknown>(`/settings/skill-categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return skillCategorySchema.parse(data);
}

export async function deleteSkillCategory(id: string): Promise<void> {
  await authFetch<void>(`/settings/skill-categories/${id}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Wage rates (US1)
// ─────────────────────────────────────────────────────────────────────────────

const wageRateSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  skillCategoryId: z.string(),
  dailyRate: decimal,
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  isCurrent: z.boolean(),
});
export type WageRate = z.infer<typeof wageRateSchema>;

export interface WageRateQuery {
  companyId?: string;
  projectId?: string;
  skillCategoryId?: string;
  asOf?: string;
}

export async function getWageRates(
  query: WageRateQuery = {},
): Promise<WageRate[]> {
  const data = await authFetch<unknown>(`/labour/wage-rates${qs({ ...query })}`);
  return z.array(wageRateSchema).parse(data);
}

export interface WageRateInput {
  companyId?: string;
  projectId: string;
  skillCategoryId: string;
  dailyRate: number;
  effectiveFrom: string;
}

export async function createWageRate(input: WageRateInput): Promise<WageRate> {
  const data = await authFetch<unknown>('/labour/wage-rates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return wageRateSchema.parse(data);
}

export async function updateWageRate(
  id: string,
  dailyRate: number,
): Promise<WageRate> {
  const data = await authFetch<unknown>(`/labour/wage-rates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ dailyRate }),
  });
  return wageRateSchema.parse(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Workers & gangs (US2)
// ─────────────────────────────────────────────────────────────────────────────

const engagementType = z.enum(ENGAGEMENT_TYPES);

const labourGender = z.enum(LABOUR_GENDERS);
export type LabourGender = z.infer<typeof labourGender>;

const workerSchema = z.object({
  id: z.string(),
  labourCode: z.string(),
  fullName: z.string(),
  // 031: father's name, mobile and skill are optional at registration.
  fatherName: z.string().nullable().catch(null),
  gender: labourGender.nullable().catch(null),
  phone: z.string().nullable(),
  skillCategoryId: z.string().nullable(),
  engagementType,
  contractorId: z.string().nullable(),
  siteId: z.string(),
  status: z.enum(['active', 'inactive']),
  aadhaarNumber: z.string().nullable(),
  bankAccount: z.string().nullable(),
  faceEnrolled: z.boolean(),
});
export type Worker = z.infer<typeof workerSchema>;

const workerPageSchema = z.object({
  items: z.array(workerSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type WorkerPage = z.infer<typeof workerPageSchema>;

const workerDetailSchema = workerSchema.extend({
  rateOverride: nullableDecimal,
});
export type WorkerDetail = z.infer<typeof workerDetailSchema>;

export interface WorkerQuery {
  companyId?: string;
  siteId?: string;
  skillCategoryId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function getWorkers(
  query: WorkerQuery = {},
): Promise<WorkerPage> {
  const data = await authFetch<unknown>(`/labour/workers${qs({ ...query })}`);
  return workerPageSchema.parse(data);
}

/**
 * One page of workers as picker options (036 O11, O12): searched on the server, so a worker past
 * the first 200 can still be found — the pickers used to load `pageSize: 200` and stop there.
 */
export async function searchWorkerOptions(
  term: string,
  page: number,
  query: Omit<WorkerQuery, 'search' | 'page' | 'pageSize'> = {},
): Promise<{ items: { id: string; label: string; sublabel?: string }[]; total: number }> {
  const result = await getWorkers({
    status: 'active',
    ...query,
    search: term || undefined,
    page,
    pageSize: 25,
  });
  return {
    items: result.items.map((w) => ({
      id: w.id,
      label: w.fullName,
      sublabel: w.labourCode,
    })),
    total: result.total,
  };
}

export async function getWorker(id: string): Promise<WorkerDetail> {
  const data = await authFetch<unknown>(`/labour/workers/${id}`);
  return workerDetailSchema.parse(data);
}

export interface WorkerInput {
  companyId?: string;
  fullName: string;
  gender: LabourGender;
  fatherName?: string;
  phone?: string;
  siteId: string;
  /** 3–5 face photos, sent with the registration so nobody is registered without a face. */
  photos?: string[];
  dateOfBirth?: string;
  skillCategoryId?: string;
  engagementType?: 'direct' | 'contractor';
  contractorId?: string;
  aadhaarNumber?: string;
  bankAccount?: string;
  rateOverride?: number;
}

export async function createWorker(input: WorkerInput): Promise<Worker> {
  const data = await authFetch<unknown>('/labour/workers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return workerSchema.parse(data);
}

export async function deactivateWorker(
  id: string,
  input: { reason: string; lastWorkingDate: string },
): Promise<Worker> {
  const data = await authFetch<unknown>(`/labour/workers/${id}/deactivate`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return workerSchema.parse(data);
}

export async function enrolWorkerFace(
  id: string,
  photos: Blob[],
): Promise<{ faceEnrolled: boolean }> {
  const encoded = await Promise.all(photos.map((p) => blobToBase64(p)));
  const data = await authFetch<unknown>(
    `/labour/workers/${id}/face-enrolment`,
    { method: 'POST', body: JSON.stringify({ photos: encoded }) },
  );
  return z.object({ faceEnrolled: z.boolean() }).parse(data);
}

const gangSchema = z.object({
  id: z.string(),
  name: z.string(),
  gangLeaderWorkerId: z.string(),
  siteId: z.string(),
  isActive: z.boolean(),
  memberWorkerIds: z.array(z.string()),
});
export type Gang = z.infer<typeof gangSchema>;

export async function getGangs(
  query: { siteId?: string; companyId?: string } = {},
): Promise<Gang[]> {
  const data = await authFetch<unknown>(`/labour/gangs${qs({ ...query })}`);
  return z.array(gangSchema).parse(data);
}

export async function getGang(id: string): Promise<Gang> {
  const data = await authFetch<unknown>(`/labour/gangs/${id}`);
  return gangSchema.parse(data);
}

export interface GangInput {
  companyId?: string;
  name: string;
  gangLeaderWorkerId: string;
  siteId: string;
  memberWorkerIds: string[];
}

export async function createGang(input: GangInput): Promise<Gang> {
  const data = await authFetch<unknown>('/labour/gangs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return gangSchema.parse(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Musters (US3, US4)
// ─────────────────────────────────────────────────────────────────────────────

const attendanceType = z.enum(ATTENDANCE_TYPES).catch('full_day');

const musterListItemSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  siteName: optionalName,
  date: z.string(),
  supervisorId: z.string(),
  supervisorName: optionalName,
  status: z.enum(MUSTER_STATUSES),
  lineCount: z.number(),
  geofenceViolation: z.boolean(),
  lowGpsAccuracy: z.boolean(),
  faceMatchLowCount: z.number(),
});
export type MusterListItem = z.infer<typeof musterListItemSchema>;

const musterLineSchema = z.object({
  id: z.string(),
  workerId: z.string(),
  // 036 O8: names beside the ids.
  workerName: optionalName,
  labourCode: optionalName,
  contractorName: optionalName,
  skillCategoryName: optionalName,
  attendanceType,
  overtimeHours: nullableDecimal,
  photoRef: z.string().nullable(),
  faceMatchScore: nullableDecimal,
  faceMatchLow: z.boolean(),
  skillCategoryIdOnDay: z.string(),
  applicableRate: nullableDecimal,
});
export type MusterLine = z.infer<typeof musterLineSchema>;

const musterDetailSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  siteId: z.string(),
  siteName: optionalName,
  projectId: z.string().nullable(),
  date: z.string(),
  supervisorId: z.string(),
  supervisorName: optionalName,
  approvedByName: optionalName,
  latitude: decimal,
  longitude: decimal,
  accuracyMetres: decimal,
  geofenceViolation: z.boolean(),
  lowGpsAccuracy: z.boolean(),
  distanceFromFenceMetres: nullableDecimal,
  isOfflineSynced: z.boolean(),
  capturedAt: z.string(),
  status: z.enum(MUSTER_STATUSES),
  approvedBy: z.string().nullable(),
  returnReason: z.string().nullable(),
  lines: z.array(musterLineSchema),
});
export type MusterDetail = z.infer<typeof musterDetailSchema>;

export interface MusterQuery {
  companyId?: string;
  status?: string;
  siteId?: string;
  flagged?: boolean;
}

export async function getMusters(
  query: MusterQuery = {},
): Promise<MusterListItem[]> {
  const data = await authFetch<unknown>(`/labour/musters${qs({ ...query })}`);
  return z.array(musterListItemSchema).parse(data);
}

export async function getMuster(id: string): Promise<MusterDetail> {
  const data = await authFetch<unknown>(`/labour/musters/${id}`);
  return musterDetailSchema.parse(data);
}

export async function approveMuster(musterId: string): Promise<MusterDetail> {
  const data = await authFetch<unknown>(`/labour/musters/${musterId}/approve`, {
    method: 'PATCH',
  });
  return musterDetailSchema.parse(data);
}

export async function returnMuster(
  musterId: string,
  reason: string,
): Promise<MusterDetail> {
  const data = await authFetch<unknown>(`/labour/musters/${musterId}/return`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
  return musterDetailSchema.parse(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment sheets & disbursement (US5, US6)
// ─────────────────────────────────────────────────────────────────────────────

const paymentSheetListItemSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  /** 031: set on a site sheet; null on a pre-031 project sheet. */
  siteId: z.string().nullable().catch(null),
  periodFrom: z.string(),
  periodTo: z.string(),
  engagementType,
  status: z.enum(PAYMENT_SHEET_STATUSES),
  grossTotal: decimal,
  deductionTotal: decimal,
  netTotal: decimal,
});
export type PaymentSheetListItem = z.infer<typeof paymentSheetListItemSchema>;

const deductionSchema = z.object({
  type: z.string(),
  advanceId: z.string().optional(),
  // Nullable because a deduction on a **cash** line is nulled with the rest of the row when the
  // company hides cash — the interceptor applies a row's mode to everything nested under it. This
  // was `decimal`, and one cash disbursement made the whole sheet fail to parse.
  amount: hideableDecimal,
  label: z.string(),
});

const paymentSheetLineSchema = z.object({
  id: z.string(),
  workerId: z.string(),
  workerName: optionalName,
  labourCode: optionalName,
  /** 036 O4: `carry_forward` pays an earlier sheet's shortfall and has no days of its own. */
  kind: z.enum(['wage', 'carry_forward']).catch('wage'),
  carriedFromLineId: z.string().nullable().optional().catch(null),
  daysWorked: decimal,
  overtimeHours: decimal,
  resolvedRate: decimal,
  rateSource: z.enum(RATE_SOURCES),
  grossWage: decimal,
  deductions: z.array(deductionSchema).catch([]),
  netPayable: decimal,
  paymentMode: z.enum(LABOUR_PAYMENT_MODES).nullable(),
  paidOn: z.string().nullable(),
  paidAmount: nullableDecimal,
  shortPaymentReason: z.string().nullable(),
  carriedForwardBalance: decimal,
  status: z.enum(PAYMENT_SHEET_LINE_STATUSES),
  amountHidden,
});
export type PaymentSheetLine = z.infer<typeof paymentSheetLineSchema>;

const paymentSheetSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  siteId: z.string().nullable().catch(null),
  siteName: optionalName,
  periodFrom: z.string(),
  periodTo: z.string(),
  engagementType,
  status: z.enum(PAYMENT_SHEET_STATUSES),
  grossTotal: decimal,
  deductionTotal: decimal,
  netTotal: decimal,
  denominationBreakup: z.unknown().nullable(),
  approvedBy: z.string().nullable(),
  closedAt: z.string().nullable(),
  summary: z.object({
    disbursedCount: z.number(),
    pendingCount: z.number(),
    disbursedAmount: decimal,
    outstandingAmount: decimal,
    /** 036 O4: what this sheet pays of earlier sheets' shortfalls. */
    carriedForwardAmount: decimal.optional().catch(0).transform((v) => v ?? 0),
  }),
  lines: z.array(paymentSheetLineSchema),
});
export type PaymentSheet = z.infer<typeof paymentSheetSchema>;

export interface PaymentSheetQuery {
  companyId?: string;
  projectId?: string;
  siteId?: string;
  engagementType?: string;
  status?: string;
}

export async function getPaymentSheets(
  query: PaymentSheetQuery = {},
): Promise<PaymentSheetListItem[]> {
  const data = await authFetch<unknown>(
    `/labour/payment-sheets${qs({ ...query })}`,
  );
  return z.array(paymentSheetListItemSchema).parse(data);
}

export async function getPaymentSheet(id: string): Promise<PaymentSheet> {
  const data = await authFetch<unknown>(`/labour/payment-sheets/${id}`);
  return paymentSheetSchema.parse(data);
}

export interface GeneratePaymentSheetInput {
  companyId?: string;
  siteId: string;
  periodFrom: string;
  periodTo: string;
  engagementType?: 'direct' | 'contractor';
}

export async function generatePaymentSheet(
  input: GeneratePaymentSheetInput,
): Promise<PaymentSheet> {
  const data = await authFetch<unknown>('/labour/payment-sheets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return paymentSheetSchema.parse(data);
}

export async function approvePaymentSheet(id: string): Promise<PaymentSheet> {
  const data = await authFetch<unknown>(
    `/labour/payment-sheets/${id}/approve`,
    { method: 'PATCH' },
  );
  return paymentSheetSchema.parse(data);
}

export async function reopenPaymentSheet(
  id: string,
  reason: string,
): Promise<PaymentSheet> {
  const data = await authFetch<unknown>(`/labour/payment-sheets/${id}/reopen`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
  return paymentSheetSchema.parse(data);
}

/**
 * Works a draft sheet out again from the attendance as it stands (036 O2) — after a rate is set,
 * an advance disbursed, a punch corrected. Draft only.
 */
export async function regeneratePaymentSheet(id: string): Promise<PaymentSheet> {
  const data = await authFetch<unknown>(
    `/labour/payment-sheets/${id}/regenerate`,
    { method: 'POST' },
  );
  return paymentSheetSchema.parse(data);
}

/** Deletes a draft sheet (036 O2): its days can be corrected again and its advances are freed. */
export async function deletePaymentSheet(id: string, reason?: string): Promise<void> {
  await authFetch<unknown>(`/labour/payment-sheets/${id}`, {
    method: 'DELETE',
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

const denominationBreakupSchema = z.object({
  notes: z.record(z.string(), z.number()),
  totalNotes: z.number(),
  expressibleTotal: decimal,
  residuals: z.array(
    z.object({ workerId: z.string(), residual: decimal }),
  ),
});
export type DenominationBreakup = z.infer<typeof denominationBreakupSchema>;

export async function getDenominations(
  id: string,
): Promise<DenominationBreakup | null> {
  const data = await authFetch<unknown>(
    `/labour/payment-sheets/${id}/denominations`,
  );
  if (data === null || data === undefined) return null;
  return denominationBreakupSchema.parse(data);
}

export interface DisburseLineInput {
  paymentMode: 'cash' | 'bank';
  paidOn: string;
  paidAmount: number;
  acknowledgement?: string;
  shortPaymentReason?: string;
}

export async function disburseLine(
  lineId: string,
  input: DisburseLineInput,
): Promise<PaymentSheet> {
  const data = await authFetch<unknown>(
    `/labour/payment-sheets/lines/${lineId}/disburse`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return paymentSheetSchema.parse(data);
}

export async function reverseLine(
  lineId: string,
  reason: string,
): Promise<PaymentSheet> {
  const data = await authFetch<unknown>(
    `/labour/payment-sheets/lines/${lineId}/reverse`,
    { method: 'PATCH', body: JSON.stringify({ reason }) },
  );
  return paymentSheetSchema.parse(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Advances (US7)
// ─────────────────────────────────────────────────────────────────────────────

const advanceSchema = z.object({
  id: z.string(),
  workerId: z.string(),
  amount: decimal,
  reason: z.string(),
  recoveryInstalments: z.number(),
  instalmentAmount: decimal,
  recoveryStartPeriod: z.string(),
  outstandingBalance: decimal,
  exceedsLimit: z.boolean(),
  status: z.enum(ADVANCE_STATUSES),
  recoveryAtRisk: z.boolean(),
  // 036 O8 / O12: names beside the ids, and who asked — the requester may not approve their own.
  workerName: optionalName,
  labourCode: optionalName,
  createdBy: optionalName,
  createdByName: optionalName,
  approvedBy: optionalName,
  approvedByName: optionalName,
});
export type Advance = z.infer<typeof advanceSchema>;

const advanceDetailSchema = advanceSchema.extend({
  recoveryHistory: z
    .array(
      z.object({
        sheetId: z.string(),
        lineId: z.string(),
        amount: decimal,
        paidOn: z.string().nullable(),
      }),
    )
    .catch([]),
});
export type AdvanceDetail = z.infer<typeof advanceDetailSchema>;

export interface AdvanceQuery {
  companyId?: string;
  workerId?: string;
  status?: string;
}

export async function getAdvances(
  query: AdvanceQuery = {},
): Promise<Advance[]> {
  const data = await authFetch<unknown>(`/labour/advances${qs({ ...query })}`);
  return z.array(advanceSchema).parse(data);
}

export async function getAdvance(id: string): Promise<AdvanceDetail> {
  const data = await authFetch<unknown>(`/labour/advances/${id}`);
  return advanceDetailSchema.parse(data);
}

/** The server's own limits on an advance (036 O12), mirrored so the form refuses first. */
export const MAX_ADVANCE_AMOUNT = 1_000_000;
export const MAX_RECOVERY_INSTALMENTS = 104;

export interface AdvanceInput {
  companyId?: string;
  workerId: string;
  amount: number;
  reason: string;
  recoveryInstalments: number;
  recoveryStartPeriod: string;
}

export async function createAdvance(input: AdvanceInput): Promise<Advance> {
  const data = await authFetch<unknown>('/labour/advances', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return advanceSchema.parse(data);
}

export async function approveAdvance(id: string): Promise<Advance> {
  const data = await authFetch<unknown>(`/labour/advances/${id}/approve`, {
    method: 'PATCH',
  });
  return advanceSchema.parse(data);
}

export async function disburseAdvance(id: string): Promise<Advance> {
  const data = await authFetch<unknown>(`/labour/advances/${id}/disburse`, {
    method: 'PATCH',
  });
  return advanceSchema.parse(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports (US8)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportPeriodQuery {
  companyId?: string;
  periodFrom: string;
  periodTo: string;
}

const deploymentReportSchema = z.object({
  groupBy: z.string(),
  groups: z.array(
    z.object({
      key: z.string(),
      /** 036 O8: the site, contractor or skill name for `key`. */
      label: optionalName,
      headcount: z.number(),
      manDays: decimal,
    }),
  ),
  totalManDays: decimal,
});
export type DeploymentReport = z.infer<typeof deploymentReportSchema>;

export async function getDeploymentReport(
  query: ReportPeriodQuery & { projectId: string; groupBy: string },
): Promise<DeploymentReport> {
  const data = await authFetch<unknown>(
    `/labour/reports/deployment${qs({ ...query })}`,
  );
  return deploymentReportSchema.parse(data);
}

const attendanceReportSchema = z.object({
  siteId: z.string(),
  siteName: optionalName,
  totalMusterDays: z.number(),
  workers: z.array(
    z.object({
      workerId: z.string(),
      workerName: optionalName,
      labourCode: optionalName,
      daysPresent: z.number(),
      halfDays: z.number(),
      absentDays: z.number(),
      overtimeHours: decimal,
      attendancePercent: decimal,
    }),
  ),
});
export type AttendanceReport = z.infer<typeof attendanceReportSchema>;

export async function getAttendanceReport(
  query: ReportPeriodQuery & { siteId: string },
): Promise<AttendanceReport> {
  const data = await authFetch<unknown>(
    `/labour/reports/attendance${qs({ ...query })}`,
  );
  return attendanceReportSchema.parse(data);
}

const paymentRegisterSchema = z.object({
  projectId: z.string(),
  lines: z.array(
    z.object({
      sheetId: z.string(),
      siteName: optionalName,
      periodFrom: z.string().optional().catch(undefined),
      periodTo: z.string().optional().catch(undefined),
      workerId: z.string(),
      workerName: optionalName,
      labourCode: optionalName,
      kind: z.enum(['wage', 'carry_forward']).catch('wage'),
      daysWorked: decimal,
      grossWage: decimal,
      netPayable: decimal,
      paymentMode: z.enum(LABOUR_PAYMENT_MODES).nullable(),
      status: z.string(),
    }),
  ),
});
export type PaymentRegister = z.infer<typeof paymentRegisterSchema>;

export async function getPaymentRegister(
  query: ReportPeriodQuery & { projectId: string },
): Promise<PaymentRegister> {
  const data = await authFetch<unknown>(
    `/labour/reports/payment-register${qs({ ...query })}`,
  );
  return paymentRegisterSchema.parse(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Face attendance, site rates and supervisor sites (031)
// ─────────────────────────────────────────────────────────────────────────────

const siteOptionSchema = z.object({ id: z.string(), name: z.string() });
export type LabourSiteOption = z.infer<typeof siteOptionSchema>;

/** The sites the caller may register labour and mark attendance at. */
export async function getMyLabourSites(): Promise<LabourSiteOption[]> {
  const data = await authFetch<unknown>('/labour/my-sites');
  return z.array(siteOptionSchema).parse(data);
}

const labourDayRowSchema = z.object({
  workerId: z.string(),
  labourCode: z.string(),
  fullName: z.string(),
  fatherName: z.string().nullable(),
  gender: labourGender.nullable().catch(null),
  faceEnrolled: z.boolean(),
  punchInAt: z.string().nullable(),
  punchOutAt: z.string().nullable(),
  /**
   * 036 O5: an in-punch from yesterday still open (within 16 hours) — a night shift the supervisor
   * can punch out today. Null otherwise.
   */
  openShiftFrom: z.string().nullable().optional().catch(null).transform((v) => v ?? null),
  status: z.string().catch('absent'),
  hours: z.number().nullable().catch(null),
  overtimeHours: z.number().catch(0),
});
export type LabourDayRow = z.infer<typeof labourDayRowSchema>;

const labourDaySchema = z.object({
  date: z.string(),
  items: z.array(labourDayRowSchema),
});
export type LabourDay = z.infer<typeof labourDaySchema>;

export async function getLabourToday(siteId: string): Promise<LabourDay> {
  const data = await authFetch<unknown>(
    `/labour/attendance/today${qs({ siteId })}`,
  );
  return labourDaySchema.parse(data);
}

export interface LabourPunchInput {
  siteId: string;
  workerId: string;
  type: 'in' | 'out';
  photo: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

const labourPunchResultSchema = z.object({
  workerId: z.string(),
  type: z.enum(['in', 'out']),
  punchedAt: z.string(),
  status: z.string(),
  hours: z.number().nullable(),
  overtimeHours: z.number(),
  geofenceViolation: z.boolean(),
});
export type LabourPunchResult = z.infer<typeof labourPunchResultSchema>;

export async function punchLabour(
  input: LabourPunchInput,
): Promise<LabourPunchResult> {
  const data = await authFetch<unknown>('/labour/attendance/punch', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return labourPunchResultSchema.parse(data);
}

const labourRefusalSchema = z.object({
  id: z.string(),
  workerId: z.string(),
  labourCode: z.string().nullable(),
  fullName: z.string().nullable(),
  type: z.enum(['in', 'out']),
  reason: z.string(),
  at: z.string(),
});
export type LabourRefusal = z.infer<typeof labourRefusalSchema>;

export async function getLabourRefusals(
  siteId: string,
  days?: number,
): Promise<LabourRefusal[]> {
  const data = await authFetch<unknown>(
    `/labour/attendance/refusals${qs({ siteId, days })}`,
  );
  return z.array(labourRefusalSchema).parse(data);
}

const siteWageRateSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  gender: labourGender,
  dailyRate: decimal,
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  isCurrent: z.boolean(),
});
export type SiteWageRate = z.infer<typeof siteWageRateSchema>;

export async function getSiteWageRates(siteId?: string): Promise<SiteWageRate[]> {
  const data = await authFetch<unknown>(`/labour/site-rates${qs({ siteId })}`);
  return z.array(siteWageRateSchema).parse(data);
}

export interface SiteWageRateInput {
  siteId: string;
  effectiveFrom: string;
  maleRate?: number;
  femaleRate?: number;
}

export async function createSiteWageRates(
  input: SiteWageRateInput,
): Promise<SiteWageRate[]> {
  const data = await authFetch<unknown>('/labour/site-rates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return z.array(siteWageRateSchema).parse(data);
}

export async function updateSiteWageRate(
  id: string,
  dailyRate: number,
): Promise<SiteWageRate> {
  const data = await authFetch<unknown>(`/labour/site-rates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ dailyRate }),
  });
  return siteWageRateSchema.parse(data);
}

const supervisorAssignmentSchema = z.object({
  userId: z.string(),
  name: z.string(),
  siteIds: z.array(z.string()),
});
export type SupervisorAssignment = z.infer<typeof supervisorAssignmentSchema>;

const supervisorAssignmentsSchema = z.object({
  supervisors: z.array(supervisorAssignmentSchema),
  sites: z.array(siteOptionSchema),
});
export type SupervisorAssignments = z.infer<typeof supervisorAssignmentsSchema>;

export async function getSupervisorSites(): Promise<SupervisorAssignments> {
  const data = await authFetch<unknown>('/labour/supervisor-sites');
  return supervisorAssignmentsSchema.parse(data);
}

export async function setSupervisorSites(
  userId: string,
  siteIds: string[],
): Promise<SupervisorAssignment> {
  const data = await authFetch<unknown>(
    `/labour/supervisor-sites/${encodeURIComponent(userId)}`,
    { method: 'PUT', body: JSON.stringify({ siteIds }) },
  );
  return supervisorAssignmentSchema.parse(data);
}

/** The month-end consolidated attendance sheet. Omit `siteId` for every site the caller sees. */
export async function downloadLabourAttendanceSheet(query: {
  siteId?: string;
  year: number;
  month: number;
}): Promise<{ blob: Blob; filename: string }> {
  const { blob, filename } = await authFetchFile(
    `/labour/sheets/attendance${qs({ ...query })}`,
  );
  return {
    blob,
    filename:
      filename ??
      `Labour attendance ${query.year}-${String(query.month).padStart(2, '0')}.xlsx`,
  };
}

export async function downloadPaymentSheetXlsx(
  id: string,
): Promise<{ blob: Blob; filename: string }> {
  const { blob, filename } = await authFetchFile(`/labour/sheets/payment/${id}`);
  return { blob, filename: filename ?? 'Labour payment sheet.xlsx' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Muster attendance from punch times (034)
// ─────────────────────────────────────────────────────────────────────────────

export const LABOUR_DAY_STATUSES = [
  'full_day',
  'half_day',
  'short',
  'on_site',
  'unresolved',
  'absent',
] as const;
export type LabourDayStatus = (typeof LABOUR_DAY_STATUSES)[number];
export type LabourDayFlag = 'missing_punch_out' | 'missing_punch_in' | 'out_before_in';

const punchFactSchema = z.object({
  at: z.string(),
  source: z.enum(['face', 'correction']),
  corrected: z.boolean(),
  recordedBy: z.string().nullable(),
  outsideFence: z.boolean(),
});
export type PunchFact = z.infer<typeof punchFactSchema>;

const musterDaySchema = z.object({
  date: z.string(),
  punchIn: punchFactSchema.nullable(),
  punchOut: punchFactSchema.nullable(),
  hours: z.number().nullable(),
  status: z.enum(LABOUR_DAY_STATUSES),
  overtimeHours: z.number(),
  flag: z.enum(['missing_punch_out', 'missing_punch_in', 'out_before_in']).nullable(),
  manual: z.boolean(),
});
export type MusterDay = z.infer<typeof musterDaySchema>;

const musterWorkerRefSchema = z.object({
  workerId: z.string(),
  labourCode: z.string(),
  fullName: z.string(),
  fatherName: z.string().nullable(),
  gender: z.string().nullable(),
  contractorName: z.string().nullable(),
  gangName: z.string().nullable(),
  siteId: z.string(),
  siteName: z.string(),
});

const musterDailyRowSchema = musterWorkerRefSchema.merge(musterDaySchema);
export type MusterDailyRow = z.infer<typeof musterDailyRowSchema>;

const musterDailySchema = z.object({
  date: z.string(),
  today: z.string(),
  summary: z.object({
    workers: z.number(),
    present: z.number(),
    fullDay: z.number(),
    halfDay: z.number(),
    short: z.number(),
    onSite: z.number(),
    absent: z.number(),
    missingPunchOut: z.number(),
    otherFlags: z.number(),
    overtimeHours: z.number(),
  }),
  items: z.array(musterDailyRowSchema),
});
export type MusterDaily = z.infer<typeof musterDailySchema>;

export type MusterFilter =
  | 'missing_punch_out'
  | 'flagged'
  | 'present'
  | 'absent'
  | 'on_site'
  | 'short';

export async function getMusterDaily(query: {
  date?: string;
  siteId?: string;
  filter?: MusterFilter;
}): Promise<MusterDaily> {
  const data = await authFetch<unknown>(
    `/labour/muster-attendance/daily${qs({ ...query })}`,
  );
  return musterDailySchema.parse(data);
}

const musterMonthRowSchema = musterWorkerRefSchema.extend({
  days: z.record(z.string(), musterDaySchema),
  totals: z.object({
    fullDays: z.number(),
    halfDays: z.number(),
    shortDays: z.number(),
    unresolved: z.number(),
    payableDays: z.number(),
    hours: z.number(),
    overtimeHours: z.number(),
  }),
});
export type MusterMonthRow = z.infer<typeof musterMonthRowSchema>;

const musterMonthlySchema = z.object({
  year: z.number(),
  month: z.number(),
  daysInMonth: z.number(),
  today: z.string(),
  summary: z.object({
    workers: z.number(),
    unresolved: z.number(),
    payableDays: z.number(),
    overtimeHours: z.number(),
  }),
  items: z.array(musterMonthRowSchema),
});
export type MusterMonthly = z.infer<typeof musterMonthlySchema>;

export async function getMusterMonthly(query: {
  year: number;
  month: number;
  siteId?: string;
}): Promise<MusterMonthly> {
  const data = await authFetch<unknown>(
    `/labour/muster-attendance/monthly${qs({ ...query })}`,
  );
  return musterMonthlySchema.parse(data);
}

export interface PunchCorrectionInput {
  workerId: string;
  date: string;
  /** HH:mm, 24-hour. */
  punchIn?: string;
  punchOut?: string;
  /** 036 O5: the punch out is on the day after `date` — a night shift, at most 16 h after the in. */
  punchOutNextDay?: boolean;
  reason: string;
}

export async function correctLabourPunch(
  input: PunchCorrectionInput,
): Promise<MusterDailyRow> {
  const data = await authFetch<unknown>('/labour/muster-attendance/corrections', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return musterDailyRowSchema.parse(data);
}

const punchCorrectionSchema = z.object({
  id: z.string(),
  type: z.enum(['in', 'out']),
  oldPunchedAt: z.string().nullable(),
  newPunchedAt: z.string(),
  reason: z.string(),
  correctedBy: z.string().nullable(),
  correctedAt: z.string(),
});
export type PunchCorrection = z.infer<typeof punchCorrectionSchema>;

export async function getPunchCorrections(
  workerId: string,
  date: string,
): Promise<PunchCorrection[]> {
  const data = await authFetch<unknown>(
    `/labour/muster-attendance/corrections${qs({ workerId, date })}`,
  );
  return z.array(punchCorrectionSchema).parse(data);
}

const labourDayRulesSchema = z.object({
  fullDayHours: z.number(),
  halfDayHours: z.number(),
  standardHours: z.number(),
});
export type LabourDayRules = z.infer<typeof labourDayRulesSchema>;

export async function getLabourDayRules(companyId?: string): Promise<LabourDayRules> {
  const data = await authFetch<unknown>(
    `/labour/muster-attendance/rules${qs({ companyId })}`,
  );
  return labourDayRulesSchema.parse(data);
}

export async function setLabourDayRules(
  rules: LabourDayRules,
  companyId?: string,
): Promise<LabourDayRules & { recounted: number }> {
  const data = await authFetch<unknown>(
    `/labour/muster-attendance/rules${qs({ companyId })}`,
    { method: 'PUT', body: JSON.stringify(rules) },
  );
  return labourDayRulesSchema.extend({ recounted: z.number() }).parse(data);
}

const sitePhotoSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  date: z.string(),
  note: z.string().nullable(),
  takenBy: z.string().nullable(),
  takenAt: z.string(),
});
export type SitePhoto = z.infer<typeof sitePhotoSchema>;

/** A group photo for reference only — it marks nobody's attendance. */
export async function addSitePhoto(input: {
  siteId: string;
  photo: string;
  note?: string;
  latitude?: number;
  longitude?: number;
}): Promise<SitePhoto> {
  const data = await authFetch<unknown>('/labour/muster-attendance/site-photos', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return sitePhotoSchema.parse(data);
}

export async function getSitePhotos(siteId: string, date?: string): Promise<SitePhoto[]> {
  const data = await authFetch<unknown>(
    `/labour/muster-attendance/site-photos${qs({ siteId, date })}`,
  );
  return z.array(sitePhotoSchema).parse(data);
}

export async function getSitePhotoImage(id: string): Promise<Blob> {
  const { blob } = await authFetchFile(
    `/labour/muster-attendance/site-photos/${id}/image`,
  );
  return blob;
}
