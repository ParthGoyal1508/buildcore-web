import { z } from 'zod';

import { approvalStateSchemaForModules } from '@/app/lib/api/approvals';
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
  /**
   * The name the **bank** holds against the account (021 FR-008e).
   *
   * Not the employee's name as HR spells it, and often not even close: in the client's own bank
   * sample these are "Arivnd" and "Rosan". A transfer is matched on the account number, but a name
   * disagreeing with the bank's gets the payment returned — so the transfer sheet refuses a row
   * without this rather than substituting the employee's name.
   *
   * `.nullable().default(null)` so an employee record saved before the field existed still parses.
   */
  bankAccountHolderName: z.string().nullable().default(null),

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
  /**
   * The status to display: the admin's override where one was set, otherwise the
   * status the API derives from punches, leave and the site calendar.
   *
   * Required, not optional. An optional field would let a deploy without the
   * matching API silently fall back to whatever the client decided to render —
   * which is exactly the defect this replaced, where the register substituted
   * `present` for every row and reported employees who had never punched as
   * present. A loud parse failure is the better outcome.
   */
  status: z.enum(['present', 'absent', 'on_leave', 'weekly_off', 'holiday']),
  statusOverride: z.string().nullable(),
  adminEdited: z.boolean(),
  remarks: z.string().nullable(),
  hasException: z.boolean(),
  /**
   * A correction asked for on this day and not yet applied (016 FR-009c).
   *
   * **Optional, unlike `status` above, and for the opposite reason.** `status` is required
   * because a missing value there let the client invent one. Here a missing value means the
   * API predates this field, and the honest rendering of "this deploy cannot tell me whether
   * a correction is outstanding" is to show nothing — not to fail the whole screen, which
   * would take attendance viewing down during a staged rollout.
   */
  pendingCorrection: z
    .object({
      submittedAt: z.string(),
      /** The level deciding now; null once the chain has finished. */
      levelLabel: z.string().nullable(),
    })
    .nullable()
    .optional(),
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

/**
 * What `POST /hr/attendance` answers with (016 FR-009c).
 *
 * **It is an approval item, not an applied edit.** Since api 016 phase 8 this route raises the
 * correction into a Site → HR → Director chain and the attendance is unchanged until that
 * chain completes. The response was read as `unknown` before, which is how the screen came to
 * close its dialog and refetch — showing the old figures with nothing to explain them, so a
 * successful submission read as a save that had silently failed.
 */
export const attendanceCorrectionSubmissionSchema = z.object({
  approvalInstanceId: z.string(),
  state: z.string(),
});
export type AttendanceCorrectionSubmission = z.infer<
  typeof attendanceCorrectionSubmissionSchema
>;

export async function markAttendance(
  input: MarkAttendanceInput,
): Promise<AttendanceCorrectionSubmission> {
  return attendanceCorrectionSubmissionSchema.parse(
    await authFetch<unknown>('/hr/attendance', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

/**
 * An unresolved face-match or geofence exception.
 *
 * Matches `AttendanceAdminService.exceptions()` exactly. The row is keyed on
 * `punchId`, not `id` — an earlier version of this schema required `id`, so a
 * perfectly good 200 response failed to parse and the dialog reported "could not
 * load" for data it had already received.
 *
 * The endpoint returns no coordinates or distance: the exception says a punch
 * fell outside the geofence, not by how far.
 */
export const attendanceExceptionSchema = z.object({
  punchId: z.string(),
  employeeId: z.string(),
  employeeCode: z.string().nullable(),
  capturedAt: z.string(),
  punchDate: z.string(),
  faceMatchResult: z.string().nullable(),
  geofenceResult: z.string().nullable(),
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

// ─────────────────────────────────────────────────────────────────────────────
// Attendance exceptions on the approval chain (feature 016)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A flagged punch as `/workspace-admin/attendance-exceptions` returns it.
 *
 * Only the fields the exceptions surface actually renders. The endpoint sends the whole
 * `PunchRecord`, and listing all of it here would mean this schema had to be revised
 * every time an unrelated column was added to a table this screen does not own.
 *
 * `latitude` and `longitude` are deliberately absent even though they arrive: they come
 * over the wire as **strings** (Postgres `Decimal`), and nothing on this screen plots a
 * point. Declaring them as numbers is the mistake this comment exists to prevent.
 */
const flaggedPunchSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  type: z.string(),
  capturedAt: z.string(),
  punchDate: z.string(),
  faceMatchResult: z.string().nullable(),
  geofenceResult: z.string().nullable(),
  exceptionResolution: z.string().nullable(),
  resolvedByUserId: z.string().nullable(),
  resolvedAt: z.string().nullable(),
});

/**
 * One flagged punch with the state of its approval.
 *
 * `approval` is nullable, and the null case is real rather than defensive: a punch flagged
 * before this feature shipped, or one whose company has no chain configured, has no
 * instance to report. The interface must say something sensible for it instead of
 * assuming a chain exists.
 */
const attendanceExceptionRowSchema = z.object({
  punch: flaggedPunchSchema,
  approval: approvalStateSchemaForModules.nullable(),
});

export type FlaggedPunch = z.infer<typeof flaggedPunchSchema>;
export type AttendanceExceptionRow = z.infer<
  typeof attendanceExceptionRowSchema
>;

/**
 * Punches awaiting a decision, each with where its approval has got to.
 *
 * One request for the whole list, with the approval state embedded — the backend resolves
 * it in a batch. The alternative, asking the spine per row, is the mistake the batch
 * contract exists to prevent and would be one request per exception on every render.
 */
export async function getPendingAttendanceExceptions(): Promise<
  AttendanceExceptionRow[]
> {
  const data = await authFetch<unknown>('/workspace-admin/attendance-exceptions');
  return z.array(attendanceExceptionRowSchema).parse(data);
}

/**
 * Records a decision on a flagged punch at the caller's level of the chain.
 *
 * The route is unchanged from before feature 016 so the interface changed once rather
 * than twice — but a decision here is now **one level of a chain**, not the end of the
 * matter. `confirmed` at level 1 of 3 advances the item; it does not confirm the punch.
 */
export async function resolveAttendanceException(
  punchId: string,
  input: { resolution: 'confirmed' | 'rejected' | 'returned'; reason?: string },
): Promise<AttendanceExceptionRow> {
  const data = await authFetch<unknown>(
    `/workspace-admin/attendance-exceptions/${encodeURIComponent(
      punchId,
    )}/resolve`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return attendanceExceptionRowSchema.parse(data);
}

/**
 * One entry in the attendance modification trail.
 *
 * Field names mirror `hr.AttendanceModification` exactly: `before`/`after` hold
 * the diff and `actorUserId` is who made it. An earlier version of this schema
 * guessed `changedFrom`/`changedTo`/`changedByUserId`; because those were all
 * optional, it parsed successfully and rendered a table of em dashes — a wrong
 * schema that fails loudly is better than one that quietly renders nothing.
 */
export const attendanceModificationSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  date: isoDate,
  actorUserId: z.string().nullable().optional(),
  /**
   * Who made the change, by name, resolved server-side (016 FR-012d).
   *
   * Optional so an API predating it still parses; `actorUserId` remains the fallback, and an
   * audit column is the last place to render a cuid — which is why the resolution is the
   * server's job and not one request per row from here.
   */
  actorName: z.string().nullable().optional(),
  before: z.unknown().nullable().optional(),
  after: z.unknown().nullable().optional(),
  reason: z.string().nullable().optional(),
  createdAt: isoDate,
});

/**
 * The modification trail, plus who the actor filter may name.
 *
 * `actors` comes back alongside the page and is **not** narrowed by the actor filter — otherwise
 * selecting somebody would leave the dropdown holding only them, with no way back. `paginated` is
 * extended rather than replaced so the page shape stays the one every other list here speaks.
 */
const attendanceModificationsSchema = paginated(
  attendanceModificationSchema,
).extend({
  actors: z
    .array(z.object({ id: z.string(), name: z.string() }))
    .optional()
    .default([]),
});

export async function getAttendanceModifications(filters: {
  employeeId?: string;
  /** 016 FR-012d. Composes with the others rather than replacing them. */
  actorUserId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const data = await authFetch<unknown>(
    `/hr/attendance/modifications${qs({ ...filters })}`,
  );
  return attendanceModificationsSchema.parse(data);
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

/** The CSV template's header row, as a file the admin fills in and re-uploads. */
export async function downloadAttendanceImportTemplate() {
  return downloadFile('/hr/attendance/import/template');
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

/**
 * A leave application as the admin list returns it.
 *
 * The row is the raw `hr.LeaveApplication`: the day count is `dayCount` (a
 * Decimal, so it arrives as a string) and the remark is `adminRemarks`. It
 * carries no employee name or code — only `employeeId` — so the table resolves
 * the name itself rather than pretending the API supplies one.
 */
export const leaveApplicationSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  leaveType: enumOf(LEAVE_TYPES),
  fromDate: isoDate,
  toDate: isoDate,
  dayCount: decimal,
  reason: z.string().nullable(),
  status: enumOf(LEAVE_APPLICATION_STATUSES),
  adminRemarks: z.string().nullable().optional(),
  decidedAt: nullableIsoDate.optional(),

  /**
   * The employee, resolved by the server (api `src/hr/employee-name.ts`).
   *
   * `.optional()` as well as `.nullable()`, and that is not belt-and-braces: a server
   * predating the field omits the key entirely, and a schema demanding it would turn a
   * missing name into a failed parse — the whole list vanishing because one column
   * could not be filled. Null means the server looked and could not say; absent means
   * it was never asked.
   *
   * The two are separately nullable. A code with a null name is somebody with no name
   * on record; both null is somebody outside the caller's scope.
   */
  employeeCode: z.string().nullable().optional(),
  employeeName: z.string().nullable().optional(),
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

/**
 * A loan as `LoansService.toView()` returns it. No employee name or code — the
 * table resolves those from the roster.
 */
export const loanSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  amount: decimal,
  emiAmount: decimal,
  disbursementDate: isoDate,
  reason: z.string(),
  remarks: z.string().nullable().optional(),
  status: enumOf(LOAN_STATUSES),
  totalRecovered: decimal.optional(),
  outstanding: decimal.optional(),
  instalments: z.number().optional(),
});

export type Loan = z.infer<typeof loanSchema>;

/**
 * One instalment in a repayment schedule.
 *
 * The period key is `month` (`YYYY-MM`) and there is no `id` — an entry is
 * identified by its loan and month, which is also why the table keys on it. An
 * instalment records the run that recovered it, not a payment date: an EMI is
 * collected by a payroll run, so the run is the fact worth keeping.
 */
export const loanScheduleEntrySchema = z.object({
  month: z.string(),
  emiAmount: decimal,
  status: enumOf(LOAN_SCHEDULE_STATUSES),
  paidInPayrollRunId: z.string().nullable().optional(),
});

const loanDetailSchema = loanSchema.extend({
  schedule: z.array(loanScheduleEntrySchema),
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
  return loanDetailSchema.parse(await authFetch<unknown>(`/hr/loans/${id}`));
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

/**
 * The figures a Form 16 Part B is built from.
 *
 * Not the form itself — this is the computation behind it, which is what an
 * employee queries and what payroll has to be able to explain. Each declared
 * section carries both what was declared and what was actually allowed, because
 * the gap between the two is the usual reason the tax figure surprises someone.
 */
const formSixteenSchema = z.object({
  employeeId: z.string(),
  financialYear: z.string(),
  grossSalary: decimal,
  standardDeduction: decimal,
  deductionsBySection: z.array(
    z.object({
      sectionCode: z.string(),
      declaredAmount: decimal,
      allowedAmount: decimal,
      verified: z.boolean(),
    }),
  ),
  taxableIncome: decimal,
  taxDeducted: decimal,
});

export type FormSixteen = z.infer<typeof formSixteenSchema>;

export async function getFormSixteenData(
  employeeId: string,
  financialYear: string,
) {
  return formSixteenSchema.parse(
    await authFetch<unknown>(
      `/hr/tds/form-16/${employeeId}${qs({ financialYear })}`,
    ),
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

/**
 * A reimbursement claim as the admin list returns it — the raw
 * `hr.ReimbursementClaim`: `expenseDate`, `adminRemarks`, and a `categoryId`
 * rather than a resolved category name.
 */
export const adminClaimSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  categoryId: z.string().nullable().optional(),
  amount: decimal,
  expenseDate: nullableIsoDate.optional(),
  description: z.string().nullable().optional(),
  status: z.string(),
  adminRemarks: z.string().nullable().optional(),
  receiptRef: z.string().nullable().optional(),
  paymentMode: z.string().nullable().optional(),
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

/**
 * Records that a claim has been paid.
 *
 * `paymentMode` is required by the backend and genuinely matters: `payroll` adds
 * the amount to the employee's next run, while `direct` settles it outside
 * payroll and wants the transfer reference. There is no safe default — guessing
 * `payroll` would silently put money into a payroll run that an accountant had
 * already paid by bank transfer.
 */
export async function payClaim(
  id: string,
  input: { paymentMode: 'payroll' | 'direct'; paymentReference?: string },
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

// ─────────────────────────────────────────────────────────────────────────────
// Slip delivery (021 FR-005 to FR-007 — `bugs.md` item 8)
// ─────────────────────────────────────────────────────────────────────────────

export const SLIP_DELIVERY_STATUSES = [
  'pending',
  'sent',
  'failed',
  'undeliverable',
] as const;
export type SlipDeliveryStatus = (typeof SLIP_DELIVERY_STATUSES)[number];

const slipDeliveryRowSchema = z.object({
  employeeId: z.string(),
  employeeCode: z.string(),
  employeeName: z.string(),
  /**
   * The address **as sent**, not as it stands now.
   *
   * The backend stores it rather than joining it at read time, and the screen must show what it
   * stores: an employee whose email was corrected after a failure must not have the old failure read
   * as though it went to the new address.
   */
  address: z.string(),
  status: z.enum(SLIP_DELIVERY_STATUSES),
  failureReason: z.string().nullable(),
  sentAt: z.string().nullable(),
});
export type SlipDeliveryRow = z.infer<typeof slipDeliveryRowSchema>;

export const slipDeliverySummarySchema = z.object({
  runId: z.string(),
  period: z.string(),
  sent: z.number(),
  failed: z.number(),
  undeliverable: z.number(),
  /**
   * Employees in the run with no delivery row at all.
   *
   * "Nobody has tried yet" is a different thing to say from "it failed", and a screen that conflated
   * them sends somebody retrying what was never attempted.
   */
  notAttempted: z.number(),
  rows: z.array(slipDeliveryRowSchema),
});
export type SlipDeliverySummary = z.infer<typeof slipDeliverySummarySchema>;

export async function getSlipDeliveries(
  runId: string,
): Promise<SlipDeliverySummary> {
  return slipDeliverySummarySchema.parse(
    await authFetch(`/hr/payroll/runs/${runId}/slip-deliveries`),
  );
}

/** Sends to everybody not already sent to. Skips the rest, so pressing twice sends once. */
export async function sendSlipDeliveries(
  runId: string,
): Promise<SlipDeliverySummary> {
  return slipDeliverySummarySchema.parse(
    await authFetch(`/hr/payroll/runs/${runId}/slip-deliveries`, {
      method: 'POST',
    }),
  );
}

/** Resends **only** the failures. Never the undeliverable ones — they have no address. */
export async function retrySlipDeliveries(
  runId: string,
): Promise<SlipDeliverySummary> {
  return slipDeliverySummarySchema.parse(
    await authFetch(`/hr/payroll/runs/${runId}/slip-deliveries/retry`, {
      method: 'POST',
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction sheet reconciliation (021 FR-008 to FR-011 — `bugs.md` item 8)
// ─────────────────────────────────────────────────────────────────────────────

const reconciledLineSchema = z.object({
  rowNumber: z.number(),
  beneficiaryName: z.string().nullable(),
  beneficiaryAccount: z.string().nullable(),
  ifsc: z.string().nullable(),
  sheetAmount: nullableDecimal,
  matchedEmployeeId: z.string().nullable(),
  matchedEmployeeCode: z.string().nullable(),
  runAmount: nullableDecimal,
  /**
   * Sheet minus run. Positive means the bank moved more than the run said.
   *
   * Reported, not judged — a transfer short by an advance recovery is correct, and the server does
   * not know which differences are expected. The screen says the same.
   */
  difference: nullableDecimal,
  unmatchedReason: z.string().nullable(),
});
export type ReconciledLine = z.infer<typeof reconciledLineSchema>;

export const reconciliationSchema = z.object({
  runId: z.string(),
  period: z.string(),
  totalLines: z.number(),
  matched: z.number(),
  unmatched: z.number(),
  /**
   * Employees in the run with no line in the sheet — money that did **not** move.
   *
   * A separate list from the unmatched lines, deliberately: this is the half somebody chases the
   * bank about and the other half is the half somebody chases HR about.
   */
  missingFromSheet: z.array(
    z.object({
      employeeId: z.string(),
      employeeCode: z.string(),
      runAmount: decimal,
    }),
  ),
  lines: z.array(reconciledLineSchema),
});
export type Reconciliation = z.infer<typeof reconciliationSchema>;

/**
 * Uploads the bank's returned sheet and reconciles it.
 *
 * Base64 in a JSON body, matching every other upload in this product. **An unparseable row uploads
 * and is reported**: the only refusal is a file that cannot be opened as a workbook, because there
 * the remedy is a different file rather than a report.
 */
export async function uploadTransactionSheet(
  runId: string,
  file: File,
): Promise<Reconciliation> {
  const data = await fileToBase64(file);
  return reconciliationSchema.parse(
    await authFetch(`/hr/payroll/runs/${runId}/transaction-sheet`, {
      method: 'POST',
      body: JSON.stringify({ data, contentType: file.type }),
    }),
  );
}

/**
 * A file as base64, without its data-URL prefix.
 *
 * `FileReader` rather than `btoa` over a string: a spreadsheet is binary, and `btoa` on a string read
 * as text corrupts every byte above 0x7F — which is most of a zip archive, and an `.xlsx` is one.
 */
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunked, because `String.fromCharCode(...bytes)` on a megabyte-long array exceeds the argument
  // limit and throws — on exactly the large files somebody would upload.
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
