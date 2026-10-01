import { z } from 'zod';
import { approvalStateSchemaForModules } from '@/app/lib/api/approvals';
import { API_URL } from '@/app/lib/config';
import { getAccessToken, authFetch } from '@/app/lib/session';

/**
 * The `/my/*` client (contracts/my-workspace-ui.md).
 *
 * Every response is parsed through a zod schema before reaching a component, the
 * same posture `settings.ts` takes: the backend is trusted, but a shape change on
 * its side should fail loudly here rather than surface as `undefined` three
 * components deep.
 *
 * No function in this file takes an employee identifier. The backend resolves the
 * caller's own employee record from the token (FR-028), and adding a parameter here
 * would only invite a caller to believe one exists.
 */

// ------------------------------------------------------------------ Schemas

export const reEnrolmentStateSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'completed', 'expired']),
  reason: z.string(),
  adminRemarks: z.string().nullable(),
  requestedAt: z.string(),
  decidedAt: z.string().nullable(),
  unlockExpiresAt: z.string().nullable(),
  unlockActive: z.boolean(),
});
export type ReEnrolmentState = z.infer<typeof reEnrolmentStateSchema>;

export const faceEnrolmentStatusSchema = z.object({
  status: z.enum(['not_enrolled', 'enrolled', 're_enrolment_requested']),
  enrolledAt: z.string().nullable(),
  reEnrolment: reEnrolmentStateSchema.nullable(),
});
export type FaceEnrolmentStatus = z.infer<typeof faceEnrolmentStatusSchema>;

export const punchResultSchema = z.object({
  id: z.string(),
  type: z.enum(['in', 'out']),
  capturedAt: z.string(),
  isOfflineSync: z.boolean(),
  faceMatchResult: z.enum(['matched', 'exception']),
  geofenceResult: z.enum(['in_range', 'exception']),
});
export type PunchResult = z.infer<typeof punchResultSchema>;

/**
 * One side of a modification — what the day held before, or what it holds after (016 FR-009a).
 *
 * **These times are `HH:mm` in UTC**, not the ISO timestamps `inTime`/`outTime` below carry. The
 * API builds them with `toISOString().slice(11, 16)`, so a punch made at 09:05 IST arrives here
 * as `03:35` while the row beside it renders 09:05 in the reader's own zone. Rendering the two
 * the same way without converting would show an employee "In changed from 03:35 to 03:40" next
 * to a row reading 09:05 — every figure correct, the pair of them incomprehensible. The day's
 * date is needed to convert, which is why the component does it rather than this schema.
 *
 * Every field optional: an administrator who changed only the out time leaves the others as they
 * were, and the diff is worth showing for what moved rather than for all three.
 */
export const attendanceSnapshotSchema = z
  .object({
    inTime: z.string().nullable().optional(),
    outTime: z.string().nullable().optional(),
    statusOverride: z.string().nullable().optional(),
  })
  // Tolerant: this is a JSON column, and a future field appearing in it must not take an
  // employee's attendance screen down.
  .passthrough();
export type AttendanceSnapshot = z.infer<typeof attendanceSnapshotSchema>;

/** One administrative change to one day, as the affected employee sees it (016 FR-009a). */
export const attendanceModificationSchema = z.object({
  /** The actor's **name**. The requirement is that the employee can see who changed their day. */
  actorName: z.string(),
  at: z.string(),
  before: attendanceSnapshotSchema,
  after: attendanceSnapshotSchema,
  /**
   * Free text, written by an administrator who did not necessarily know the employee would read
   * it — and genuinely absent on plenty of rows. Distinguished from an empty string in the
   * component, because "no reason given" and a blank must not look the same (T047).
   */
  reason: z.string().nullable(),
});
export type AttendanceModification = z.infer<
  typeof attendanceModificationSchema
>;

export const attendanceDaySchema = z.object({
  date: z.string(),
  dayOfWeek: z.number(),
  inTime: z.string().nullable(),
  outTime: z.string().nullable(),
  otHours: z.number().nullable(),
  status: z.enum(['present', 'absent', 'on_leave', 'weekly_off', 'holiday']),
  /**
   * Administrative changes to this day, oldest first (016 FR-009a).
   *
   * **Optional, so a day from an API that predates this field still validates.** The alternative
   * — required — would throw on every employee's attendance screen during a staged rollout, which
   * is a worse failure than a month rendering without modification detail it does not have.
   * Defaulted to empty so no component has to decide what a missing array means.
   */
  modifications: z.array(attendanceModificationSchema).optional().default([]),
});
export type AttendanceDay = z.infer<typeof attendanceDaySchema>;

export const LEAVE_TYPES = ['earned', 'casual', 'sick', 'lwp'] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const leaveBalanceSchema = z.object({
  leaveType: z.enum(LEAVE_TYPES),
  financialYear: z.string(),
  opening: z.number(),
  accrued: z.number(),
  used: z.number(),
  balance: z.number(),
});
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>;

export const leaveApplicationSchema = z.object({
  id: z.string(),
  leaveType: z.enum(LEAVE_TYPES),
  fromDate: z.string(),
  toDate: z.string(),
  // Prisma serialises Decimal as a string; accept either and normalise to a number
  // so no component has to remember which it got.
  dayCount: z.union([z.number(), z.string()]).transform(Number),
  reason: z.string(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']),
  adminRemarks: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type LeaveApplication = z.infer<typeof leaveApplicationSchema>;

const moneyGroupSchema = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, total: z.number() });

export const salarySlipSchema = z.object({
  period: z.string(),
  employeeCode: z.string(),
  monthDays: z.number(),
  payableDays: z.number(),
  lopDays: z.number(),
  otHours: z.number(),
  earnings: moneyGroupSchema({
    basic: z.number(),
    hra: z.number(),
    conveyance: z.number(),
    siteAllowance: z.number(),
    specialAllowance: z.number(),
    ot: z.number(),
  }),
  deductions: moneyGroupSchema({
    pf: z.number(),
    esic: z.number(),
    pt: z.number(),
    tds: z.number(),
    loanEmi: z.number(),
    advanceRecovery: z.number(),
  }),
  employerContributions: moneyGroupSchema({
    pf: z.number(),
    eps: z.number(),
    edli: z.number(),
    adminCharges: z.number(),
    gratuity: z.number(),
    bonus: z.number(),
  }),
  netPay: z.number(),
  netPayInWords: z.string(),
  minimumWagesNote: z.string().nullable(),
});
export type SalarySlip = z.infer<typeof salarySlipSchema>;

export const reimbursementCategorySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  /** Null means a receipt is never required — distinct from `0`, which requires
   * one on every claim. */
  receiptRequiredAbove: z.number().nullable(),
});
export type ReimbursementCategory = z.infer<typeof reimbursementCategorySchema>;

export const REIMBURSEMENT_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'paid',
  'withdrawn',
] as const;
export type ReimbursementStatus = (typeof REIMBURSEMENT_STATUSES)[number];

export const reimbursementClaimSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  // Prisma serialises DECIMAL as a string; coerce so components can format a
  // number rather than each deciding how to parse it.
  amount: z.coerce.number(),
  expenseDate: z.string(),
  description: z.string(),
  receiptRef: z.string().nullable(),
  status: z.enum(REIMBURSEMENT_STATUSES),
  paymentMode: z.enum(['payroll', 'direct']).nullable().optional(),
  createdAt: z.string(),
});
export type ReimbursementClaim = z.infer<typeof reimbursementClaimSchema>;

// -------------------------------------------------------------- Face enrol

/**
 * Photos travel as base64 data URLs, not multipart.
 *
 * The capture surface is a canvas snapshot that already lives in memory as a Blob,
 * and the backend's DTO takes `photos: string[]` — so one JSON body keeps a single
 * validation path on both sides.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function getEnrolmentStatus(): Promise<FaceEnrolmentStatus> {
  return faceEnrolmentStatusSchema.parse(await authFetch('/my/face-enrol'));
}

export async function enrol(input: {
  photos: Blob[];
  consentMethod: 'signed_paper' | 'digital' | 'verbal';
}): Promise<FaceEnrolmentStatus> {
  const photos = await Promise.all(input.photos.map(blobToBase64));
  return faceEnrolmentStatusSchema.parse(
    await authFetch('/my/face-enrol', {
      method: 'POST',
      body: JSON.stringify({
        photos,
        consentMethod: input.consentMethod,
        consentAcknowledged: true,
      }),
    }),
  );
}

export async function withdrawConsent(): Promise<FaceEnrolmentStatus> {
  return faceEnrolmentStatusSchema.parse(
    await authFetch('/my/face-enrol/consent', { method: 'DELETE' }),
  );
}

/** Derived from the same status call rather than a second endpoint — one request,
 * one source of truth for what the screen may offer. */
export async function getReEnrolmentState(): Promise<ReEnrolmentState | null> {
  return (await getEnrolmentStatus()).reEnrolment;
}

export async function requestReEnrolment(reason: string): Promise<void> {
  await authFetch('/my/face-enrol/re-enrolment-request', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function completeReEnrolment(input: {
  photos: Blob[];
}): Promise<FaceEnrolmentStatus> {
  const photos = await Promise.all(input.photos.map(blobToBase64));
  return faceEnrolmentStatusSchema.parse(
    await authFetch('/my/face-enrol/re-enrolment-complete', {
      method: 'POST',
      body: JSON.stringify({ photos, consentAcknowledged: true }),
    }),
  );
}

// ------------------------------------------------------------------- Punch

export interface PunchInput {
  type: 'in' | 'out';
  photo: Blob;
  latitude: number;
  longitude: number;
  /**
   * The GPS accuracy radius the device reported, in metres (020 FR-014a).
   *
   * The backend judges a punch inside its fence when the distance falls within
   * `radius + accuracy`, so a worker standing legitimately at a site with a poor
   * fix is not refused for the device's uncertainty. Without this the allowance
   * cannot be applied and every punch is judged on its raw point — which costs
   * nothing today, because a failing check still records a reviewable exception,
   * and costs people their pay the day 020's hard refusal lands.
   *
   * **Optional, and omitted rather than zeroed** when the device reports no
   * accuracy (FR-014b). A `0` asserts a perfect fix, which is the opposite of
   * "unknown", and would deny the worker the very allowance this field exists to
   * give them.
   */
  accuracyMeters?: number;
  capturedAt: string;
}

export async function submitPunch(input: PunchInput): Promise<PunchResult> {
  return punchResultSchema.parse(
    await authFetch('/my/punch', {
      method: 'POST',
      body: JSON.stringify({
        type: input.type,
        photo: await blobToBase64(input.photo),
        latitude: input.latitude,
        longitude: input.longitude,
        // `accuracyMeters` — American and singular, which is the backend's spelling
        // on this endpoint only. The muster endpoint and `offline-queue.ts` both use
        // `accuracyMetres`, and both are correct where they are.
        //
        // Do not "tidy" these to match each other. The backend validates this field
        // with `@IsOptional()`, so a misspelt key is **ignored without error**: the
        // punch still returns 201 and is still judged on its raw point, exactly as
        // though accuracy had never been sent. Nothing logs and nothing fails, and
        // the bug would only become visible once the hard refusal exists — as honest
        // workers being refused.
        accuracyMeters: input.accuracyMeters,
        capturedAt: input.capturedAt,
      }),
    }),
  );
}

export const todayPunchStateSchema = z.object({
  punchedInAt: z.string().nullable(),
  punchedOutAt: z.string().nullable(),
  /** Both punches recorded — nothing further is accepted today (backend FR-008). */
  isComplete: z.boolean(),
});
export type TodayPunchState = z.infer<typeof todayPunchStateSchema>;

/**
 * What the employee has already punched today, and whether the day is finished.
 *
 * Read from the server rather than inferred from the attendance row: the backend
 * allows one punch-in and one punch-out per day, and a screen guessing at that
 * offers actions the server then refuses. A punch-in left open on an earlier day is
 * deliberately not reported — it cannot be closed and does not constrain today.
 */
export async function getTodayPunchState(): Promise<TodayPunchState> {
  return todayPunchStateSchema.parse(await authFetch('/my/punch/open'));
}

export async function getAttendanceHistory(
  month: number,
  year: number,
): Promise<AttendanceDay[]> {
  const body = await authFetch<{ days: unknown }>(
    `/my/punch/history?month=${month}&year=${year}`,
  );
  return z.array(attendanceDaySchema).parse(body.days);
}

// ------------------------------------------------------------------- Leave

export async function getLeaveBalance(
  financialYear?: string,
): Promise<LeaveBalance[]> {
  const query = financialYear ? `?financialYear=${financialYear}` : '';
  return z
    .array(leaveBalanceSchema)
    .parse(await authFetch(`/my/leave/balance${query}`));
}

export async function getLeaveApplications(): Promise<LeaveApplication[]> {
  return z
    .array(leaveApplicationSchema)
    .parse(await authFetch('/my/leave/applications'));
}

export async function applyLeave(input: {
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
}): Promise<LeaveApplication> {
  return leaveApplicationSchema.parse(
    await authFetch('/my/leave/applications', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function cancelLeaveApplication(
  id: string,
): Promise<LeaveApplication> {
  return leaveApplicationSchema.parse(
    await authFetch(`/my/leave/applications/${id}/cancel`, { method: 'POST' }),
  );
}

// ------------------------------------------------------------------ Salary

export async function getAvailablePeriods(): Promise<string[]> {
  return z.array(z.string()).parse(await authFetch('/my/salary/available-periods'));
}

export async function getSalarySlip(period: string): Promise<SalarySlip> {
  return salarySlipSchema.parse(await authFetch(`/my/salary/${period}`));
}

/**
 * The payslip PDF (research.md §8).
 *
 * Uses raw `fetch` rather than `authFetch`, which parses JSON and would choke on a
 * PDF body. The cost is that this one call does not get `authFetch`'s
 * refresh-on-401 retry — acceptable because it is always a deliberate tap on a
 * screen the user has already loaded through an authenticated request moments
 * earlier, so an expired token here is a re-tap rather than a lost session.
 */
export async function downloadSalarySlipPdf(period: string): Promise<Blob> {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/my/salary/${period}/pdf`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error('Could not download the payslip. Please try again.');
  }
  return res.blob();
}

// ---------------------------------------------------------- Reimbursements

export async function getReimbursementCategories(): Promise<
  ReimbursementCategory[]
> {
  return z
    .array(reimbursementCategorySchema)
    .parse(await authFetch('/my/reimbursements/categories'));
}

export async function getReimbursementClaims(): Promise<ReimbursementClaim[]> {
  return z
    .array(reimbursementClaimSchema)
    .parse(await authFetch('/my/reimbursements'));
}

export interface ClaimInput {
  categoryId: string;
  amount: number;
  /** `YYYY-MM-DD`. */
  expenseDate: string;
  description: string;
  /** Base64 image data. Stored server-side in this same request, which is why no
   * separate upload call exists — a two-step upload would orphan the blob of every
   * claim the employee then abandons. */
  receipt?: string;
  status?: 'draft' | 'submitted';
}

export async function createReimbursementClaim(
  input: ClaimInput,
): Promise<ReimbursementClaim> {
  return reimbursementClaimSchema.parse(
    await authFetch('/my/reimbursements', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateReimbursementClaim(
  id: string,
  input: Partial<ClaimInput>,
): Promise<ReimbursementClaim> {
  return reimbursementClaimSchema.parse(
    await authFetch(`/my/reimbursements/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

/** Retracts a claim still in review. Distinct from deleting a draft: a withdrawn
 * claim stays on the record, a deleted draft never existed. */
export async function withdrawReimbursementClaim(
  id: string,
): Promise<ReimbursementClaim> {
  return reimbursementClaimSchema.parse(
    await authFetch(`/my/reimbursements/${id}/withdraw`, { method: 'POST' }),
  );
}

export async function deleteReimbursementClaim(id: string): Promise<void> {
  await authFetch(`/my/reimbursements/${id}`, { method: 'DELETE' });
}

// ------------------------------------------- Attendance exceptions (016 T042)

/**
 * One of the caller's own flagged punches and where its approval has got to.
 *
 * The shape is narrower than the reviewer's row on purpose: the backend returns the
 * fields a worker needs to recognise which punch this is, and nothing about how the
 * face match was scored.
 */
const myPunchExceptionSchema = z.object({
  punch: z.object({
    id: z.string(),
    capturedAt: z.string(),
    punchDate: z.string(),
    type: z.enum(['in', 'out']),
    faceMatchResult: z.string().nullable(),
    geofenceResult: z.string().nullable(),
  }),
  /** Null for a punch that never entered a chain — a pre-016 row, or a failed submit. */
  approval: approvalStateSchemaForModules.nullable(),
});

export type MyPunchException = z.infer<typeof myPunchExceptionSchema>;

/**
 * The caller's own flagged punches.
 *
 * No employee parameter, like everything else in this file: the backend resolves the
 * employee from the token, and an approver who reviews these same punches on the admin
 * screen is refused here outright because they have no employee record of their own.
 */
export async function getMyPunchExceptions(): Promise<MyPunchException[]> {
  return z
    .array(myPunchExceptionSchema)
    .parse(await authFetch('/my/punch/exceptions'));
}
