import { z } from 'zod';

import {
  ADVANCE_STATUSES,
  ATTENDANCE_TYPES,
  ENGAGEMENT_TYPES,
  LABOUR_PAYMENT_MODES,
  MUSTER_STATUSES,
  PAYMENT_SHEET_LINE_STATUSES,
  PAYMENT_SHEET_STATUSES,
  RATE_SOURCES,
} from '@/app/lib/constants';
import { authFetch } from '@/app/lib/session';

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

const workerSchema = z.object({
  id: z.string(),
  labourCode: z.string(),
  fullName: z.string(),
  phone: z.string(),
  skillCategoryId: z.string(),
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

export async function getWorker(id: string): Promise<WorkerDetail> {
  const data = await authFetch<unknown>(`/labour/workers/${id}`);
  return workerDetailSchema.parse(data);
}

export interface WorkerInput {
  fullName: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  skillCategoryId: string;
  engagementType: 'direct' | 'contractor';
  contractorId?: string;
  siteId: string;
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

export async function getGangs(query: { siteId?: string } = {}): Promise<Gang[]> {
  const data = await authFetch<unknown>(`/labour/gangs${qs({ ...query })}`);
  return z.array(gangSchema).parse(data);
}

export async function getGang(id: string): Promise<Gang> {
  const data = await authFetch<unknown>(`/labour/gangs/${id}`);
  return gangSchema.parse(data);
}

export interface GangInput {
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
  date: z.string(),
  supervisorId: z.string(),
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
  projectId: z.string().nullable(),
  date: z.string(),
  supervisorId: z.string(),
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

export interface OpenMusterInput {
  siteId: string;
  date: string;
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  capturedAt?: string;
}

export async function openMuster(input: OpenMusterInput): Promise<MusterDetail> {
  const data = await authFetch<unknown>('/labour/musters', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return musterDetailSchema.parse(data);
}

export interface CaptureMusterLineInput {
  workerId: string;
  attendanceType: string;
  overtimeHours?: number;
  photo: string;
}

export interface CaptureMusterInput extends OpenMusterInput {
  lines: CaptureMusterLineInput[];
}

/** Composite offline-drain path: opens, marks and submits in one call (FR-011). */
export async function captureMuster(
  input: CaptureMusterInput,
): Promise<MusterDetail> {
  const data = await authFetch<unknown>('/labour/musters/capture', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return musterDetailSchema.parse(data);
}

export async function addMusterLine(
  musterId: string,
  input: { workerId: string; attendanceType: string; overtimeHours?: number; photo?: string },
): Promise<MusterDetail> {
  const data = await authFetch<unknown>(`/labour/musters/${musterId}/lines`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return musterDetailSchema.parse(data);
}

export async function bulkAddGang(
  musterId: string,
  input: { gangId: string; attendanceType: string },
): Promise<MusterDetail> {
  const data = await authFetch<unknown>(
    `/labour/musters/${musterId}/lines/bulk`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return musterDetailSchema.parse(data);
}

export async function submitMuster(musterId: string): Promise<MusterDetail> {
  const data = await authFetch<unknown>(`/labour/musters/${musterId}/submit`, {
    method: 'PATCH',
  });
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
  projectId: z.string(),
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
  amount: decimal,
  label: z.string(),
});

const paymentSheetLineSchema = z.object({
  id: z.string(),
  workerId: z.string(),
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
});
export type PaymentSheetLine = z.infer<typeof paymentSheetLineSchema>;

const paymentSheetSchema = z.object({
  id: z.string(),
  projectId: z.string(),
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
  }),
  lines: z.array(paymentSheetLineSchema),
});
export type PaymentSheet = z.infer<typeof paymentSheetSchema>;

export interface PaymentSheetQuery {
  projectId?: string;
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
  projectId: string;
  periodFrom: string;
  periodTo: string;
  engagementType: 'direct' | 'contractor';
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

export interface AdvanceInput {
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
  periodFrom: string;
  periodTo: string;
}

const deploymentReportSchema = z.object({
  groupBy: z.string(),
  groups: z.array(
    z.object({ key: z.string(), headcount: z.number(), manDays: decimal }),
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
  totalMusterDays: z.number(),
  workers: z.array(
    z.object({
      workerId: z.string(),
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
      workerId: z.string(),
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
