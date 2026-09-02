import { z } from 'zod';

import { API_URL } from '@/app/lib/config';
import { authFetch, getAccessToken } from '@/app/lib/session';
import {
  ATTENDANCE_STATUS_OVERRIDES,
  CALCULATION_MODES,
  EMPLOYMENT_TYPES,
  EXIT_REASONS,
  GENDERS,
  HOLIDAY_TYPES,
  LEAVE_APPLICATION_STATUSES,
  LEAVE_TYPES,
  LOAN_SCHEDULE_STATUSES,
  LOAN_STATUSES,
  MARITAL_STATUSES,
  PAYROLL_RUN_STATUSES,
  SALARY_ADVANCE_STATUSES,
  TAX_DECLARATION_STATUSES,
  type ChallanType,
  type PiiField,
} from '@/app/lib/constants';

/**
 * Every `/dashboard/hr/*` call to `buildcore-api` (feature 005).
 *
 * One module per domain, per Constitution Principle V — no component issues its
 * own `fetch()`. Every response is parsed through a `zod` schema before the app
 * trusts it (Principle IV), and the `z.infer` type is what the UI consumes, so a
 * backend contract change surfaces here as a parse failure rather than as
 * `undefined` three components deep.
 *
 * A note on strictness: these schemas validate the fields the UI actually reads
 * and let `zod` strip the rest. That is deliberate. The backend returns full
 * Prisma rows on several of these routes, and enumerating every column would
 * make this file a duplicate of `schema.prisma` that goes stale on the first
 * migration — while buying nothing, since an unread field cannot break a screen.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A money/quantity value as it arrives on the wire.
 *
 * Prisma `Decimal` columns serialise to JSON as strings, but a computed figure
 * from a service (an aggregate, a rounded total) arrives as a number — the same
 * field can be either depending on which route produced it. Coercing here means
 * no component has to remember which is which, and `Number('')` → 0 is avoided
 * by rejecting the empty string explicitly.
 */
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

/** An ISO date-time or `YYYY-MM-DD`, kept as the string the backend sent. */
const isoDate = z.string();
const nullableIsoDate = z.string().nullable();

const enumOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values);

/** Query-string builder that drops empty values rather than sending `?x=undefined`. */
function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  });

/**
 * Downloads a generated file (register, challan, bank sheet) as a Blob.
 *
 * A raw `fetch` rather than `authFetch`, for the same reason My Workspace's
 * payslip download uses one: `authFetch` parses the response as JSON, which
 * destroys a spreadsheet body. The cost is that these calls do not get the
 * refresh-on-401 retry — acceptable, because an export is always a deliberate
 * click on a screen the user loaded through an authenticated request moments
 * earlier, so an expired token is a re-click rather than a lost session.
 *
 * The filename comes from the response's own `Content-Disposition`, so the
 * backend stays the single authority on what a downloaded register is called.
 */
export async function downloadFile(
  path: string,
): Promise<{ blob: Blob; filename: string }> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Could not produce that export. Please try again.');
  }
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return {
    blob: await res.blob(),
    filename: match ? decodeURIComponent(match[1]) : 'export',
  };
}

/** Hands a downloaded blob to the browser as a save. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick rather than immediately: revoking synchronously can
  // beat the browser to reading the URL and produce an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Employees (US1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An employee as an admin sees them.
 *
 * `aadhaar`, `pan`, `bankAccountNumber` and `uan` arrive **masked** to their last
 * four characters — the backend's `PiiMaskingInterceptor` guarantees the raw
 * columns never leave it. The full value comes only from `revealPii`, one field
 * per call, and every such call is written to the audit log.
 */
export const employeeSchema = z.object({
  id: z.string(),
  employeeCode: z.string(),
  companyId: z.string(),
  siteId: z.string(),
  shiftId: z.string(),
  userId: z.string(),

  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  title: z.string().nullable(),
  dob: nullableIsoDate,
  gender: enumOf(GENDERS).nullable(),
  maritalStatus: enumOf(MARITAL_STATUSES).nullable(),
  photoRef: z.string().nullable(),

  departmentId: z.string().nullable(),
  designationId: z.string().nullable(),
  employmentType: enumOf(EMPLOYMENT_TYPES).nullable(),
  dateOfJoining: nullableIsoDate,
  probationEndDate: nullableIsoDate,
  confirmationDate: nullableIsoDate,
  reportingToEmployeeId: z.string().nullable(),
  musterCategory: z.string().nullable(),
  hoursPerDay: nullableDecimal,
  dailyRate: nullableDecimal,
  payMode: z.string().nullable(),
  calculationMode: enumOf(CALCULATION_MODES).nullable(),
  workmanId: z.string().nullable(),
  isActive: z.boolean(),

  pfApplicable: z.boolean(),
  pfUpperLimit: z.boolean(),
  esicApplicable: z.boolean(),
  esicUpperLimit: z.boolean(),
  uan: z.string().nullable(),
  pfNumber: z.string().nullable(),
  esicNumber: z.string().nullable(),
  aadhaar: z.string().nullable(),
  pan: z.string().nullable(),

  basic: nullableDecimal,
  hra: nullableDecimal,
  conveyanceAllowance: nullableDecimal,
  siteAllowance: nullableDecimal,
  specialAllowance: nullableDecimal,
  paymentMode: z.string().nullable(),
  bankName: z.string().nullable(),
  bankBranch: z.string().nullable(),
  bankAccountNumber: z.string().nullable(),
  ifscCode: z.string().nullable(),

  mobile: z.string().nullable(),
  alternateMobile: z.string().nullable(),
  email: z.string().nullable(),
  presentAddress: z.string().nullable(),
  presentCity: z.string().nullable(),
  presentState: z.string().nullable(),
  presentPinCode: z.string().nullable(),
  permanentAddress: z.string().nullable(),
  permanentCity: z.string().nullable(),
  permanentState: z.string().nullable(),
  permanentPinCode: z.string().nullable(),
  emergencyContactName: z.string().nullable(),
  emergencyContactRelation: z.string().nullable(),
  emergencyContactPhone: z.string().nullable(),

  offerLetterIssued: z.boolean(),
  offerLetterIssuedDate: nullableIsoDate,
  appointmentLetterIssued: z.boolean(),
  appointmentLetterIssuedDate: nullableIsoDate,
  ndaSigned: z.boolean(),
  ndaSignedDate: nullableIsoDate,

  idCardIssued: z.boolean(),
  uniformProvided: z.boolean(),
  safetyInductionCompleted: z.boolean(),
  toolsIssued: z.boolean(),
  bankVerificationDone: z.boolean(),
  biometricEnrolled: z.boolean(),
  siteAccessGranted: z.boolean(),
});

export type Employee = z.infer<typeof employeeSchema>;

export interface EmployeeFilters {
  search?: string;
  departmentId?: string;
  siteId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listEmployees(filters: EmployeeFilters = {}) {
  const data = await authFetch<unknown>(`/hr/employees${qs({ ...filters })}`);
  return paginated(employeeSchema).parse(data);
}

export async function getEmployee(id: string) {
  return employeeSchema.parse(await authFetch<unknown>(`/hr/employees/${id}`));
}

/**
 * Fields an admin may set. Deliberately a partial of the view type minus what the
 * server owns: `employeeCode` is allocated from the company series and never
 * accepted from the client, and `companyId` changes only through `transferEmployee`.
 */
export type EmployeeInput = Partial<
  Omit<
    Employee,
    | 'id'
    | 'employeeCode'
    | 'companyId'
    | 'aadhaar'
    | 'pan'
    | 'bankAccountNumber'
  >
> & {
  /** Unmasked, and only ever sent — never returned on any read path. */
  aadhaar?: string | null;
  pan?: string | null;
  bankAccountNumber?: string | null;
};

export async function createEmployee(input: EmployeeInput) {
  return employeeSchema.parse(
    await authFetch<unknown>('/hr/employees', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateEmployee(id: string, input: EmployeeInput) {
  return employeeSchema.parse(
    await authFetch<unknown>(`/hr/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

const revealPiiSchema = z.object({
  field: z.string(),
  value: z.string().nullable(),
});

/** One field per call — the audit trail distinguishes a lookup from harvesting. */
export async function revealPii(id: string, field: PiiField) {
  return revealPiiSchema.parse(
    await authFetch<unknown>(`/hr/employees/${id}/reveal-pii`, {
      method: 'POST',
      body: JSON.stringify({ field }),
    }),
  );
}

export interface TransferInput {
  toCompanyId: string;
  transferDate: string;
  reason: string;
  retainCode?: boolean;
}

const transferResultSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  fromCompanyId: z.string(),
  toCompanyId: z.string(),
  transferDate: isoDate,
  previousCode: z.string().nullable().optional(),
  newCode: z.string().nullable().optional(),
});

export async function transferEmployee(id: string, input: TransferInput) {
  return transferResultSchema.parse(
    await authFetch<unknown>(`/hr/employees/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Employee documents (US2)
// ─────────────────────────────────────────────────────────────────────────────

export const employeeDocumentSchema = z.object({
  id: z.string(),
  documentTypeId: z.string(),
  documentTypeName: z.string().optional(),
  documentNumber: z.string().nullable(),
  expiresAt: nullableIsoDate,
  uploadedAt: isoDate.optional(),
  contentType: z.string().nullable().optional(),
});

const documentsResponseSchema = z.union([
  z.array(employeeDocumentSchema),
  z.object({
    items: z.array(employeeDocumentSchema),
    mandatoryTotal: z.number().optional(),
    mandatoryUploaded: z.number().optional(),
  }),
]);

export type EmployeeDocument = z.infer<typeof employeeDocumentSchema>;

/** Normalises both shapes the backend may return into one the UI can rely on. */
export async function listEmployeeDocuments(employeeId: string) {
  const parsed = documentsResponseSchema.parse(
    await authFetch<unknown>(`/hr/employees/${employeeId}/documents`),
  );
  return Array.isArray(parsed) ? { items: parsed } : parsed;
}

export interface UploadDocumentInput {
  documentTypeId: string;
  /** base64 payload, matching the backend's `file` field. */
  file: string;
  contentType: string;
  documentNumber?: string;
  expiresAt?: string;
}

export async function uploadEmployeeDocument(
  employeeId: string,
  input: UploadDocumentInput,
) {
  return employeeDocumentSchema.parse(
    await authFetch<unknown>(`/hr/employees/${employeeId}/documents`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Attendance administration (US3)
// ─────────────────────────────────────────────────────────────────────────────

export const dailyAttendanceRowSchema = z.object({
  employeeId: z.string(),
  employeeCode: z.string(),
  name: z.string(),
  siteId: z.string(),
  inTime: z.string().nullable(),
  outTime: z.string().nullable(),
  statusOverride: z.string().nullable(),
  adminEdited: z.boolean(),
  remarks: z.string().nullable(),
  hasException: z.boolean(),
});

export type DailyAttendanceRow = z.infer<typeof dailyAttendanceRowSchema>;

const dailyAttendanceSchema = z.union([
  z.array(dailyAttendanceRowSchema),
  z.object({ rows: z.array(dailyAttendanceRowSchema) }),
]);

export async function getDailyAttendance(date: string, siteId?: string) {
  const parsed = dailyAttendanceSchema.parse(
    await authFetch<unknown>(`/hr/attendance${qs({ date, siteId })}`),
  );
  return Array.isArray(parsed) ? parsed : parsed.rows;
}

export interface MarkAttendanceInput {
  employeeId: string;
  date: string;
  inTime?: string;
  outTime?: string;
  statusOverride?: (typeof ATTENDANCE_STATUS_OVERRIDES)[number];
  remarks?: string;
}

export async function markAttendance(input: MarkAttendanceInput) {
  return authFetch<unknown>('/hr/attendance', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export const attendanceExceptionSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeCode: z.string().optional(),
  name: z.string().optional(),
  punchAt: z.string().optional(),
  punchTime: z.string().optional(),
  latitude: nullableDecimal.optional(),
  longitude: nullableDecimal.optional(),
  distanceMeters: nullableDecimal.optional(),
  faceMatchResult: z.string().nullable().optional(),
  geofenceResult: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
});

export async function getAttendanceExceptions() {
  const data = await authFetch<unknown>('/hr/attendance/exceptions');
  const parsed = z
    .union([
      z.array(attendanceExceptionSchema),
      z.object({ rows: z.array(attendanceExceptionSchema) }),
    ])
    .parse(data);
  return Array.isArray(parsed) ? parsed : parsed.rows;
}

export const attendanceModificationSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  date: isoDate,
  changedByUserId: z.string().nullable().optional(),
  changedFrom: z.unknown().nullable().optional(),
  changedTo: z.unknown().nullable().optional(),
  createdAt: isoDate,
});

export async function getAttendanceModifications(filters: {
  employeeId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const data = await authFetch<unknown>(
    `/hr/attendance/modifications${qs({ ...filters })}`,
  );
  return paginated(attendanceModificationSchema).parse(data);
}

/**
 * Late-coming, early-departure and short-hours figures for a month.
 *
 * `marker` is the load-bearing field: a day with no shift configured, or no punch
 * times, reports `no_shift_assigned`/`no_punch_times` rather than zero minutes
 * late. Rendering those as "0 late" would read as perfect punctuality when it
 * actually means the data cannot answer the question — so the UI must show the
 * marker, not just the number.
 */
export const lateComingRowSchema = z.object({
  employeeId: z.string(),
  employeeCode: z.string(),
  name: z.string(),
  lateDays: z.number(),
  totalLateMinutes: z.number(),
  earlyDepartureDays: z.number(),
  shortHoursDays: z.number(),
  daysWithoutShift: z.number(),
  daysWithoutPunchTimes: z.number(),
  repeatLateComer: z.boolean(),
});

const lateComingSchema = z.object({
  period: z.string(),
  repeatLateComerThreshold: z.number(),
  note: z.string().optional(),
  rows: z.array(lateComingRowSchema),
});

export async function getLateComingReport(
  month: number,
  year: number,
  filters: { departmentId?: string; siteId?: string } = {},
) {
  return lateComingSchema.parse(
    await authFetch<unknown>(
      `/hr/attendance/late-coming${qs({ month, year, ...filters })}`,
    ),
  );
}

/**
 * One employee's attendance month, for the Employee Detail calendar.
 *
 * The admin counterpart to My Workspace's `/my/punch/history`: that route derives
 * the employee from the caller's own token and takes no employee parameter by
 * design, so it cannot serve an admin looking at somebody else's month.
 */
export const attendanceDaySchema = z.object({
  date: z.string(),
  dayOfWeek: z.number(),
  inTime: z.string().nullable(),
  outTime: z.string().nullable(),
  otHours: z.number().nullable(),
  status: z.enum(['present', 'absent', 'on_leave', 'weekly_off', 'holiday']),
});

export type AttendanceDay = z.infer<typeof attendanceDaySchema>;

export async function getEmployeeAttendanceMonth(
  employeeId: string,
  month: number,
  year: number,
) {
  return z
    .object({ days: z.array(attendanceDaySchema) })
    .parse(
      await authFetch<unknown>(
        `/hr/attendance/employee/${employeeId}${qs({ month, year })}`,
      ),
    );
}

// --- Bulk import (US13) ---

export const importRowErrorSchema = z.object({
  row: z.number(),
  errors: z.array(z.string()),
});

const importResultSchema = z.object({
  validRows: z.number().optional(),
  totalRows: z.number().optional(),
  imported: z.number().optional(),
  rejected: z.array(importRowErrorSchema).optional(),
  errors: z.array(importRowErrorSchema).optional(),
});

export type ImportResult = z.infer<typeof importResultSchema>;

export async function getAttendanceImportTemplate() {
  return authFetch<unknown>('/hr/attendance/import/template');
}

export async function validateAttendanceImport(csv: string) {
  return importResultSchema.parse(
    await authFetch<unknown>('/hr/attendance/import/validate', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
  );
}

export async function commitAttendanceImport(csv: string) {
  return importResultSchema.parse(
    await authFetch<unknown>('/hr/attendance/import/commit', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
  );
}

// --- Holidays ---

export const holidaySchema = z.object({
  id: z.string(),
  name: z.string(),
  date: isoDate,
  type: enumOf(HOLIDAY_TYPES).nullable().optional(),
  appliesToAllSites: z.boolean().optional(),
});

export type Holiday = z.infer<typeof holidaySchema>;

export async function listHolidays(
  filters: { from?: string; to?: string; siteId?: string } = {},
) {
  const data = await authFetch<unknown>(`/hr/holidays${qs({ ...filters })}`);
  const parsed = z
    .union([z.array(holidaySchema), z.object({ items: z.array(holidaySchema) })])
    .parse(data);
  return Array.isArray(parsed) ? parsed : parsed.items;
}

export interface HolidayInput {
  name: string;
  date: string;
  type?: (typeof HOLIDAY_TYPES)[number];
  appliesToAllSites?: boolean;
  siteIds?: string[];
}

export async function createHoliday(input: HolidayInput) {
  return holidaySchema.parse(
    await authFetch<unknown>('/hr/holidays', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Leave administration (US4)
// ─────────────────────────────────────────────────────────────────────────────

export const leaveApplicationSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeCode: z.string().optional(),
  employeeName: z.string().optional(),
  leaveType: enumOf(LEAVE_TYPES),
  fromDate: isoDate,
  toDate: isoDate,
  days: decimal,
  reason: z.string().nullable(),
  status: enumOf(LEAVE_APPLICATION_STATUSES),
  remarks: z.string().nullable().optional(),
  decidedAt: nullableIsoDate.optional(),
});

export type LeaveApplication = z.infer<typeof leaveApplicationSchema>;

export async function listLeaveApplications(
  filters: {
    status?: (typeof LEAVE_APPLICATION_STATUSES)[number];
    employeeId?: string;
    from?: string;
    to?: string;
  } = {},
) {
  const data = await authFetch<unknown>(
    `/hr/leave/applications${qs({ ...filters })}`,
  );
  const parsed = z
    .union([
      z.array(leaveApplicationSchema),
      z.object({ items: z.array(leaveApplicationSchema) }),
    ])
    .parse(data);
  return Array.isArray(parsed) ? parsed : parsed.items;
}

export const leaveBalanceSchema = z.object({
  leaveType: enumOf(LEAVE_TYPES),
  financialYear: z.string(),
  opening: decimal,
  accrued: decimal,
  used: decimal,
  balance: decimal.optional(),
});

export async function getLeaveBalances(employeeId: string, financialYear?: string) {
  const data = await authFetch<unknown>(
    `/hr/leave/balances${qs({ employeeId, financialYear })}`,
  );
  const parsed = z
    .union([
      z.array(leaveBalanceSchema),
      z.object({ items: z.array(leaveBalanceSchema) }),
    ])
    .parse(data);
  return Array.isArray(parsed) ? parsed : parsed.items;
}

/**
 * Approve or reject one application.
 *
 * The remark is mandatory on a rejection — the employee reads it, and "rejected"
 * with no reason is the single most common support ticket this screen generates.
 * Enforced in the form too, but stated here because this is the contract.
 */
export async function decideLeaveApplication(
  id: string,
  decision: 'approved' | 'rejected',
  remarks?: string,
) {
  return authFetch<unknown>(`/workspace-admin/leave-applications/${id}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision, remarks }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Payroll runs (US5)
// ─────────────────────────────────────────────────────────────────────────────

export const payrollRunSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  period: z.string(),
  status: enumOf(PAYROLL_RUN_STATUSES),
  isFnf: z.boolean().optional(),
  generatedAt: nullableIsoDate.optional(),
  generatedByUserId: z.string().nullable().optional(),
});

export type PayrollRun = z.infer<typeof payrollRunSchema>;

export const payrollLineItemSchema = z.object({
  id: z.string().optional(),
  employeeId: z.string(),
  employeeCode: z.string().optional(),
  name: z.string().optional(),
  projectId: z.string().nullable().optional(),
  monthDays: decimal,
  payableDays: decimal,
  lopDays: decimal,
  otHours: decimal,
  otWages: decimal,
  basic: decimal,
  hra: decimal,
  conveyanceAllowance: decimal,
  siteAllowance: decimal,
  specialAllowance: decimal,
  employeePf: decimal,
  employeeEsic: decimal,
  professionalTax: decimal,
  tds: decimal,
  loanEmiDeduction: decimal,
  netPay: decimal,
  employerPf: decimal,
  employerEps: decimal,
  employerEdli: decimal,
  adminCharges: decimal,
  employerEsic: decimal,
  gratuity: decimal,
  bonus: decimal,
});

export type PayrollLineItem = z.infer<typeof payrollLineItemSchema>;

const payrollRunDetailSchema = payrollRunSchema.extend({
  lineItems: z.array(payrollLineItemSchema).optional(),
  exceptions: z.array(z.string()).optional(),
});

export async function listPayrollRuns() {
  const data = await authFetch<unknown>('/hr/payroll/runs');
  const parsed = z
    .union([
      z.array(payrollRunSchema),
      z.object({ items: z.array(payrollRunSchema) }),
    ])
    .parse(data);
  return Array.isArray(parsed) ? parsed : parsed.items;
}

export async function getPayrollRun(id: string) {
  return payrollRunDetailSchema.parse(
    await authFetch<unknown>(`/hr/payroll/runs/${id}`),
  );
}

export async function generatePayrollRun(period: string) {
  return payrollRunDetailSchema.parse(
    await authFetch<unknown>('/hr/payroll/runs', {
      method: 'POST',
      body: JSON.stringify({ period }),
    }),
  );
}

/**
 * Draft → Processed → Paid, one direction only.
 *
 * Processing freezes the figures and locks the period against attendance edits;
 * marking paid is terminal. Both are confirmed in the UI before they are sent,
 * because neither can be undone from this screen.
 */
export async function setPayrollRunStatus(
  id: string,
  status: (typeof PAYROLL_RUN_STATUSES)[number],
) {
  return payrollRunSchema.parse(
    await authFetch<unknown>(`/hr/payroll/runs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  );
}

/** The bank salary sheet for a run, as a file. */
export async function downloadBankSheet(id: string) {
  return downloadFile(`/hr/payroll/runs/${id}/bank-sheet`);
}

// --- Registers (US16) ---

export const registerRowSchema = z.object({
  employeeCode: z.string(),
  name: z.string(),
  designationId: z.string().nullable(),
  departmentId: z.string().nullable(),
  projectId: z.string().nullable(),
  daysPaid: decimal,
  lopDays: decimal,
  basic: decimal,
  hra: decimal,
  conveyance: decimal,
  siteAllowance: decimal,
  specialAllowance: decimal,
  otWages: decimal,
  gross: decimal,
  employeePf: decimal,
  employeeEsic: decimal,
  professionalTax: decimal,
  tds: decimal,
  loanEmi: decimal,
  totalDeductions: decimal,
  netPay: decimal,
});

const salaryRegisterSchema = z.object({
  runId: z.string(),
  period: z.string(),
  status: z.string(),
  filtered: z.boolean(),
  rows: z.array(registerRowSchema),
  totals: z.object({
    gross: decimal,
    totalDeductions: decimal,
    netPay: decimal,
  }),
  /**
   * The register must agree with the run it came from. When it does not, this
   * carries the explanation — the UI surfaces it as a blocking banner rather than
   * a toast, because filing a register that disagrees with its own run is exactly
   * the failure this check exists to prevent.
   */
  reconciliation: z.union([
    z.object({ ok: z.literal(true) }),
    z.object({ ok: z.literal(false), message: z.string() }),
  ]),
});

export type SalaryRegister = z.infer<typeof salaryRegisterSchema>;

export async function getSalaryRegister(
  runId: string,
  filters: { departmentId?: string; projectId?: string; siteId?: string } = {},
) {
  return salaryRegisterSchema.parse(
    await authFetch<unknown>(
      `/hr/payroll/runs/${runId}/salary-register${qs({ ...filters })}`,
    ),
  );
}

const deductionReportSchema = z.object({
  runId: z.string(),
  period: z.string(),
  status: z.string(),
  heads: z.array(
    z.object({
      head: z.string(),
      statutory: z.boolean(),
      employeeCount: z.number(),
      total: decimal,
    }),
  ),
  totals: z.object({ statutory: decimal, nonStatutory: decimal }),
});

export async function exportSalaryRegister(
  runId: string,
  filters: { departmentId?: string; projectId?: string; siteId?: string } = {},
) {
  return downloadFile(
    `/hr/payroll/runs/${runId}/salary-register/export${qs({ ...filters })}`,
  );
}

export async function getDeductionReport(runId: string) {
  return deductionReportSchema.parse(
    await authFetch<unknown>(`/hr/payroll/runs/${runId}/deduction-report`),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Statutory challans (US6)
// ─────────────────────────────────────────────────────────────────────────────

const challanSchema = z.object({
  type: z.string().optional(),
  period: z.string(),
  rows: z.array(z.record(z.string(), z.unknown())).optional(),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  totals: z.record(z.string(), z.unknown()).optional(),
});

export type Challan = z.infer<typeof challanSchema>;

export async function getChallan(type: ChallanType, period: string) {
  return challanSchema.parse(
    await authFetch<unknown>(`/hr/challans/${type}${qs({ period })}`),
  );
}

export async function exportChallan(type: ChallanType, period: string) {
  return downloadFile(`/hr/challans/${type}/export${qs({ period })}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Loans (US7)
// ─────────────────────────────────────────────────────────────────────────────

export const loanSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeCode: z.string().optional(),
  employeeName: z.string().optional(),
  amount: decimal,
  emiAmount: decimal,
  disbursementDate: isoDate,
  reason: z.string(),
  remarks: z.string().nullable().optional(),
  status: enumOf(LOAN_STATUSES),
  outstanding: nullableDecimal.optional(),
});

export type Loan = z.infer<typeof loanSchema>;

export const loanScheduleEntrySchema = z.object({
  id: z.string(),
  period: z.string(),
  emiAmount: decimal,
  status: enumOf(LOAN_SCHEDULE_STATUSES),
  paidAt: nullableIsoDate.optional(),
});

const loanDetailSchema = loanSchema.extend({
  schedule: z.array(loanScheduleEntrySchema).optional(),
  scheduleEntries: z.array(loanScheduleEntrySchema).optional(),
});

export async function listLoans(
  filters: { employeeId?: string; status?: (typeof LOAN_STATUSES)[number] } = {},
) {
  const data = await authFetch<unknown>(`/hr/loans${qs({ ...filters })}`);
  const parsed = z
    .union([z.array(loanSchema), z.object({ items: z.array(loanSchema) })])
    .parse(data);
  return Array.isArray(parsed) ? parsed : parsed.items;
}

export async function getLoan(id: string) {
  const parsed = loanDetailSchema.parse(
    await authFetch<unknown>(`/hr/loans/${id}`),
  );
  return { ...parsed, schedule: parsed.schedule ?? parsed.scheduleEntries ?? [] };
}

export interface LoanInput {
  employeeId: string;
  amount: number;
  emiAmount: number;
  disbursementDate: string;
  reason: string;
  remarks?: string;
  firstRecoveryPeriod?: string;
}

export async function createLoan(input: LoanInput) {
  return loanSchema.parse(
    await authFetch<unknown>('/hr/loans', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

/** Generates the repayment schedule; EMIs start deducting from the next run. */
export async function approveLoan(id: string) {
  return authFetch<unknown>(`/hr/loans/${id}/approve`, { method: 'PATCH' });
}

export async function closeLoan(id: string, reason: string) {
  return authFetch<unknown>(`/hr/loans/${id}/close`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Salary advances (US15)
// ─────────────────────────────────────────────────────────────────────────────

export const salaryAdvanceSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeCode: z.string().optional(),
  employeeName: z.string().optional(),
  amount: decimal,
  reason: z.string(),
  recoveryMonth: z.string(),
  outstandingBalance: nullableDecimal.optional(),
  status: enumOf(SALARY_ADVANCE_STATUSES),
});

export type SalaryAdvance = z.infer<typeof salaryAdvanceSchema>;

export async function listSalaryAdvances(
  filters: {
    employeeId?: string;
    status?: (typeof SALARY_ADVANCE_STATUSES)[number];
  } = {},
) {
  const data = await authFetch<unknown>(`/hr/salary-advances${qs({ ...filters })}`);
  const parsed = z
    .union([
      z.array(salaryAdvanceSchema),
      z.object({ items: z.array(salaryAdvanceSchema) }),
    ])
    .parse(data);
  return Array.isArray(parsed) ? parsed : parsed.items;
}

export interface SalaryAdvanceInput {
  employeeId: string;
  amount: number;
  reason: string;
  /** `YYYY-MM` — the run the whole amount is recovered from, in one go. */
  recoveryMonth: string;
}

export async function createSalaryAdvance(input: SalaryAdvanceInput) {
  return salaryAdvanceSchema.parse(
    await authFetch<unknown>('/hr/salary-advances', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function approveSalaryAdvance(id: string) {
  return authFetch<unknown>(`/hr/salary-advances/${id}/approve`, {
    method: 'PATCH',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TDS (US14)
// ─────────────────────────────────────────────────────────────────────────────

export const taxSlabBandSchema = z.object({
  lowerBound: decimal,
  upperBound: nullableDecimal,
  ratePercent: decimal,
});

export type TaxSlabBand = z.infer<typeof taxSlabBandSchema>;

export async function getTaxSlabs(financialYear: string, regime: 'old' | 'new') {
  const data = await authFetch<unknown>(
    `/hr/tds/slabs${qs({ financialYear, regime })}`,
  );
  const parsed = z
    .union([
      z.array(taxSlabBandSchema),
      z.object({ bands: z.array(taxSlabBandSchema) }),
    ])
    .parse(data);
  return Array.isArray(parsed) ? parsed : parsed.bands;
}

/**
 * Replaces a year's slab set as a whole, never band by band.
 *
 * A set is only meaningful complete: a gap lets income fall through untaxed and
 * an overlap taxes it twice. The client checks contiguity before submitting
 * (it holds every band, so it can), and the backend rejects it again regardless.
 */
export async function setTaxSlabs(
  financialYear: string,
  regime: 'old' | 'new',
  bands: TaxSlabBand[],
) {
  return authFetch<unknown>('/hr/tds/slabs', {
    method: 'POST',
    body: JSON.stringify({ financialYear, regime, bands }),
  });
}

export const declarationLineSchema = z.object({
  id: z.string().optional(),
  sectionCode: z.string(),
  declaredAmount: decimal,
  proofRef: z.string().nullable().optional(),
  status: enumOf(TAX_DECLARATION_STATUSES).optional(),
});

const declarationSchema = z.object({
  id: z.string().optional(),
  employeeId: z.string().optional(),
  financialYear: z.string(),
  regime: z.enum(['old', 'new']),
  lines: z.array(declarationLineSchema),
});

export type TaxDeclaration = z.infer<typeof declarationSchema>;

export async function getTaxDeclaration(employeeId: string, financialYear: string) {
  return declarationSchema
    .nullable()
    .parse(
      await authFetch<unknown>(
        `/hr/tds/declarations/${employeeId}${qs({ financialYear })}`,
      ),
    );
}

export async function saveTaxDeclaration(
  employeeId: string,
  input: {
    financialYear: string;
    regime: 'old' | 'new';
    lines: { sectionCode: string; declaredAmount: number; proofRef?: string }[];
  },
) {
  return authFetch<unknown>(`/hr/tds/declarations/${employeeId}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function verifyDeclarationLine(lineId: string) {
  return authFetch<unknown>(`/hr/tds/declarations/lines/${lineId}/verify`, {
    method: 'PATCH',
  });
}

export const quarterlyTdsRowSchema = z.object({
  employeeId: z.string(),
  employeeCode: z.string().optional(),
  name: z.string().optional(),
  pan: z.string().nullable().optional(),
  /** True when the employee has no PAN — taxed at the higher no-PAN rate. */
  missingPan: z.boolean().optional(),
  tdsDeducted: decimal.optional(),
});

const quarterlyTdsSchema = z.object({
  financialYear: z.string(),
  quarter: z.number(),
  rows: z.array(quarterlyTdsRowSchema),
  total: nullableDecimal.optional(),
});

export async function getQuarterlyTds(
  financialYear: string,
  quarter: 1 | 2 | 3 | 4,
) {
  return quarterlyTdsSchema.parse(
    await authFetch<unknown>(`/hr/tds/quarterly${qs({ financialYear, quarter })}`),
  );
}

export async function getFormSixteenData(
  employeeId: string,
  financialYear: string,
) {
  return authFetch<unknown>(
    `/hr/tds/form-16/${employeeId}${qs({ financialYear })}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Offboarding & Full and Final (US11)
// ─────────────────────────────────────────────────────────────────────────────

export const exitRecordSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  lastWorkingDay: isoDate,
  reason: enumOf(EXIT_REASONS),
  remarks: z.string().nullable().optional(),
  fnfPayrollRunId: z.string().nullable().optional(),
});

export type ExitRecord = z.infer<typeof exitRecordSchema>;

export async function initiateExit(
  employeeId: string,
  input: {
    lastWorkingDay: string;
    reason: (typeof EXIT_REASONS)[number];
    remarks?: string;
  },
) {
  return exitRecordSchema.parse(
    await authFetch<unknown>(`/hr/employees/${employeeId}/exit`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function getExit(employeeId: string) {
  return exitRecordSchema
    .nullable()
    .parse(await authFetch<unknown>(`/hr/employees/${employeeId}/exit`));
}

const fnfSchema = z.object({
  employeeId: z.string(),
  lastWorkingDay: z.string(),
  period: z.string(),
  pendingSalary: decimal,
  leaveEncashment: z.object({
    balanceDays: decimal,
    dailyRate: decimal,
    amount: decimal,
  }),
  loanRecovery: decimal,
  advanceRecovery: decimal,
  statutoryDeductions: decimal,
  netPayable: decimal,
  /** Surfaced verbatim above the figures — each one is a reason to stop. */
  warnings: z.array(z.string()),
});

export type FnfComputation = z.infer<typeof fnfSchema>;

export async function computeFnf(employeeId: string) {
  return fnfSchema.parse(
    await authFetch<unknown>(`/hr/employees/${employeeId}/fnf`),
  );
}

export async function processFnf(employeeId: string, period?: string) {
  return authFetch<unknown>(`/hr/employees/${employeeId}/fnf/process`, {
    method: 'POST',
    body: JSON.stringify({ period }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reimbursement claims — admin review (US12)
// ─────────────────────────────────────────────────────────────────────────────

export const adminClaimSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeCode: z.string().optional(),
  employeeName: z.string().optional(),
  category: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  amount: decimal,
  claimDate: nullableIsoDate.optional(),
  status: z.string(),
  remarks: z.string().nullable().optional(),
  receiptRef: z.string().nullable().optional(),
});

export type AdminClaim = z.infer<typeof adminClaimSchema>;

export async function listAdminClaims(
  filters: { status?: string; employeeId?: string; from?: string; to?: string } = {},
) {
  const data = await authFetch<unknown>(`/hr/reimbursements${qs({ ...filters })}`);
  const parsed = z
    .union([
      z.array(adminClaimSchema),
      z.object({ items: z.array(adminClaimSchema) }),
    ])
    .parse(data);
  return Array.isArray(parsed) ? parsed : parsed.items;
}

export async function approveClaim(id: string, remarks?: string) {
  return authFetch<unknown>(`/hr/reimbursements/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ remarks }),
  });
}

export async function rejectClaim(id: string, remarks: string) {
  return authFetch<unknown>(`/hr/reimbursements/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ remarks }),
  });
}

export async function payClaim(
  id: string,
  input: { paymentMode?: string; remarks?: string } = {},
) {
  return authFetch<unknown>(`/hr/reimbursements/${id}/pay`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Biometric re-enrolment review (US10)
// ─────────────────────────────────────────────────────────────────────────────

export const reEnrolmentRequestSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  employeeCode: z.string().optional(),
  employeeName: z.string().optional(),
  reason: z.string().nullable().optional(),
  status: z.string(),
  requestedAt: nullableIsoDate.optional(),
  expiresAt: nullableIsoDate.optional(),
});

export type ReEnrolmentRequest = z.infer<typeof reEnrolmentRequestSchema>;

export async function listReEnrolmentRequests() {
  const data = await authFetch<unknown>('/hr/re-enrolment-requests');
  const parsed = z
    .union([
      z.array(reEnrolmentRequestSchema),
      z.object({ items: z.array(reEnrolmentRequestSchema) }),
    ])
    .parse(data);
  return Array.isArray(parsed) ? parsed : parsed.items;
}

export async function decideReEnrolment(
  id: string,
  decision: 'approved' | 'rejected',
  reason?: string,
) {
  return authFetch<unknown>(
    `/workspace-admin/re-enrolment-requests/${id}/decide`,
    { method: 'POST', body: JSON.stringify({ decision, reason }) },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference data owned by other modules
// ─────────────────────────────────────────────────────────────────────────────

const siteOptionSchema = z.object({ id: z.string(), name: z.string() });

/**
 * Sites, for the pickers on the employee form and the attendance filters.
 *
 * Lives here rather than in `settings.ts` because `Site` belongs to the `projects`
 * module, not to Settings. The backend endpoint behind it was added for this
 * feature — `Employee.siteId` is mandatory and nothing enumerated sites — and
 * feature 008 will supersede it with real Site administration.
 */
export async function listSites() {
  return z
    .array(siteOptionSchema)
    .parse(await authFetch<unknown>('/projects/sites'));
}

export type SiteOption = z.infer<typeof siteOptionSchema>;
