import { z } from 'zod';

import {
  CANDIDATE_SOURCES,
  CANDIDATE_STAGES,
  INTERVIEW_MODES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_ROUND_TYPES,
  OFFER_STATUSES,
  REQUISITION_EMPLOYMENT_TYPES,
  REQUISITION_STATUSES,
  RESIGNATION_REASON_CATEGORIES,
  RESIGNATION_STATUSES,
} from '@/app/lib/constants';
import { totalCountOf } from '@/app/lib/api/client';
import {
  authFetch,
  authFetchBlob,
  authFetchWithMeta,
} from '@/app/lib/session';

/**
 * Every `/recruitment/*` and `/recruitment/letter-templates` call to `buildcore-api`
 * (feature 011). One module per domain (Principle V); every response validated with a
 * `zod` schema at the boundary (Principle IV). Candidate stage/status enums use
 * `.catch` so an unknown value renders rather than throwing (spec FR-025).
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

function qs(
  params: Record<string, string | number | boolean | undefined | null>,
) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    s.set(k, String(v));
  }
  const q = s.toString();
  return q ? `?${q}` : '';
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Requisitions ─────────────────────────────────────────────────────────────

const requisitionSchema = z.object({
  id: z.string(),
  requisitionCode: z.string(),
  departmentId: z.string(),
  designationId: z.string(),
  positionCount: z.number(),
  filledPositions: z.number(),
  openPositions: z.number(),
  employmentType: z.enum(REQUISITION_EMPLOYMENT_TYPES).catch('permanent'),
  projectId: z.string().nullable(),
  siteId: z.string().nullable(),
  targetJoiningDate: z.string(),
  budgetedCtcMin: decimal,
  budgetedCtcMax: decimal,
  justification: z.string(),
  status: z.enum(REQUISITION_STATUSES).catch('draft'),
  candidateCount: z.number(),
  ageInDays: z.number(),
});
export type Requisition = z.infer<typeof requisitionSchema>;
const requisitionPageSchema = z.object({
  items: z.array(requisitionSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type RequisitionPage = z.infer<typeof requisitionPageSchema>;

export interface RequisitionQuery {
  status?: string;
  departmentId?: string;
  projectId?: string;
  page?: number;
  pageSize?: number;
}
export async function getRequisitions(
  query: RequisitionQuery = {},
): Promise<RequisitionPage> {
  return requisitionPageSchema.parse(
    await authFetch(`/recruitment/requisitions${qs({ ...query })}`),
  );
}
export async function getRequisition(id: string): Promise<Requisition> {
  return requisitionSchema.parse(
    await authFetch(`/recruitment/requisitions/${id}`),
  );
}
export interface RequisitionInput {
  /**
   * The company the write belongs to.
   *
   * **No longer sent by any screen** (019 FR-004). The backend derives it from the
   * caller's session: `companyScope()` resolves a cross-company caller who has selected
   * a company to that company, and a caller pinned to one company to their own.
   *
   * It stays on the type because the backend still accepts it, and because the case it
   * covered is now handled better by refusing: a cross-company Super Admin with no
   * selection gets an explicit "companyId is required", where the retired
   * `CompanyProvider` silently supplied whichever company sorted first — so a record
   * could be created against a company nobody chose.
   */
  companyId?: string;
  departmentId: string;
  designationId: string;
  positionCount: number;
  employmentType: string;
  projectId?: string;
  siteId?: string;
  targetJoiningDate: string;
  budgetedCtcMin: number;
  budgetedCtcMax: number;
  justification: string;
}
export async function createRequisition(
  input: RequisitionInput,
): Promise<Requisition> {
  return requisitionSchema.parse(
    await authFetch('/recruitment/requisitions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}
const reqAction = (id: string, action: string, body?: unknown) =>
  authFetch(`/recruitment/requisitions/${id}/${action}`, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
export async function approveRequisition(id: string): Promise<Requisition> {
  return requisitionSchema.parse(await reqAction(id, 'approve'));
}
export async function submitRequisitionForApproval(
  id: string,
): Promise<Requisition> {
  return requisitionSchema.parse(await reqAction(id, 'submit'));
}
export async function rejectRequisition(
  id: string,
  reason: string,
): Promise<Requisition> {
  return requisitionSchema.parse(await reqAction(id, 'reject', { reason }));
}
export async function deleteRequisition(id: string): Promise<void> {
  await authFetch(`/recruitment/requisitions/${id}`, { method: 'DELETE' });
}

// ── Candidates ───────────────────────────────────────────────────────────────

const candidateStage = z.enum(CANDIDATE_STAGES).catch('applied');

const candidateSchema = z.object({
  id: z.string(),
  requisitionId: z.string(),
  fullName: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  totalExperienceYears: decimal,
  currentEmployer: z.string().nullable(),
  currentCtc: z.string().nullable(),
  expectedCtc: z.string().nullable(),
  source: z.enum(CANDIDATE_SOURCES).catch('portal'),
  stage: candidateStage,
  employeeId: z.string().nullable(),
  hasResume: z.boolean(),
  noShow: z.boolean(),
});
export type Candidate = z.infer<typeof candidateSchema>;
const candidatePageSchema = z.object({
  items: z.array(candidateSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type CandidatePage = z.infer<typeof candidatePageSchema>;

const candidateDetailSchema = z.object({
  id: z.string(),
  requisitionId: z.string(),
  fullName: z.string(),
  phone: z.string(),
  email: z.string(),
  totalExperienceYears: decimal,
  currentEmployer: z.string().nullable(),
  currentCtc: nullableDecimal,
  expectedCtc: nullableDecimal,
  source: z.enum(CANDIDATE_SOURCES).catch('portal'),
  referredByEmployeeId: z.string().nullable(),
  fatherName: z.string().nullable().default(null),
  address: z.string().nullable().default(null),
  stage: candidateStage,
  employeeId: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  hasResume: z.boolean(),
  stageHistory: z.array(
    z.object({
      fromStage: candidateStage.nullable(),
      toStage: candidateStage,
      actorId: z.string().nullable(),
      occurredAt: z.string(),
      remarks: z.string().nullable(),
    }),
  ),
});
export type CandidateDetail = z.infer<typeof candidateDetailSchema>;

export interface CandidateQuery {
  requisitionId?: string;
  stage?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
export async function getCandidates(
  query: CandidateQuery = {},
): Promise<CandidatePage> {
  // 200 is the server's ceiling (`MAX_PAGE_SIZE`), not a promise that everything fits: the
  // pipeline pages and searches on the server (036 H1); callers that still ask for a page this
  // size use it as a lookup, never as "all the candidates".
  return candidatePageSchema.parse(
    await authFetch(
      `/recruitment/candidates${qs({ ...query, pageSize: query.pageSize ?? 200 })}`,
    ),
  );
}
/** Unmasked detail — never cache the result (spec FR-006). */
export async function getCandidate(id: string): Promise<CandidateDetail> {
  return candidateDetailSchema.parse(
    await authFetch(`/recruitment/candidates/${id}`),
  );
}
const candidateTimelineSchema = z.object({
  addedAt: z.string(),
  rejectionReason: z.string().nullable(),
  stages: z.array(
    z.object({
      fromStage: candidateStage.nullable(),
      toStage: candidateStage,
      occurredAt: z.string(),
      remarks: z.string().nullable(),
      actorName: z.string().nullable(),
    }),
  ),
});
export type CandidateTimeline = z.infer<typeof candidateTimelineSchema>;
/**
 * Every stage change with who made it (2026-10-14). No contact details, so — unlike
 * `getCandidate` — reading it is not an audited reveal, and the candidate panel shows it on open.
 */
export async function getCandidateTimeline(
  id: string,
): Promise<CandidateTimeline> {
  return candidateTimelineSchema.parse(
    await authFetch(`/recruitment/candidates/${id}/timeline`),
  );
}
export interface CandidateInput {
  /**
   * The company the write belongs to.
   *
   * **No longer sent by any screen** (019 FR-004). The backend derives it from the
   * caller's session: `companyScope()` resolves a cross-company caller who has selected
   * a company to that company, and a caller pinned to one company to their own.
   *
   * It stays on the type because the backend still accepts it, and because the case it
   * covered is now handled better by refusing: a cross-company Super Admin with no
   * selection gets an explicit "companyId is required", where the retired
   * `CompanyProvider` silently supplied whichever company sorted first — so a record
   * could be created against a company nobody chose.
   */
  companyId?: string;
  requisitionId: string;
  fullName: string;
  phone: string;
  email: string;
  totalExperienceYears: number;
  currentEmployer?: string;
  currentCtc?: number;
  expectedCtc?: number;
  source: string;
  referredByEmployeeId?: string;
  /** Printed on the offer letter; carried onto the employee at joining. */
  fatherName?: string;
  /** Postal address, one line. Becomes the permanent address at joining. */
  address?: string;
}
export async function createCandidate(input: CandidateInput) {
  return authFetch<{ id: string; stage: string }>('/recruitment/candidates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export async function uploadResume(id: string, file: Blob) {
  const encoded = await blobToBase64(file);
  return authFetch(`/recruitment/candidates/${id}/resume`, {
    method: 'POST',
    body: JSON.stringify({
      file: encoded,
      contentType: file.type || 'application/pdf',
    }),
  });
}
export async function transitionStage(
  id: string,
  stage: string,
  remarks?: string,
) {
  return authFetch(`/recruitment/candidates/${id}/stage`, {
    method: 'PATCH',
    body: JSON.stringify({ stage, remarks }),
  });
}
export async function rejectCandidate(id: string, rejectionReason: string) {
  return authFetch(`/recruitment/candidates/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ rejectionReason }),
  });
}
export async function markNoShow(id: string, reason: string) {
  return authFetch(`/recruitment/candidates/${id}/mark-no-show`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

// ── Interviews ───────────────────────────────────────────────────────────────

const interviewSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  candidateName: z.string(),
  requisitionId: z.string(),
  roundNumber: z.number(),
  roundType: z.enum(INTERVIEW_ROUND_TYPES).catch('technical'),
  scheduledAt: z.string(),
  mode: z.enum(INTERVIEW_MODES).catch('video'),
  location: z.string().nullable(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).catch('scheduled'),
  rescheduleCount: z.number(),
  overdue: z.boolean(),
  interviewerEmployeeIds: z.array(z.string()),
  /**
   * The panel with names, resolved by the server (036 H4) — `'Former employee'` for somebody who
   * has since left. The screens resolved ids against the first page of active employees and
   * printed a raw id for anyone else. Defaults to empty so an older API still parses; read it
   * through `interviewerName`, which falls back to the id.
   */
  interviewers: z
    .array(z.object({ employeeId: z.string(), name: z.string() }))
    .default([]),
  feedback: z.array(
    z.object({
      interviewerEmployeeId: z.string(),
      outcome: z.enum(INTERVIEW_OUTCOMES).catch('hold'),
      score: z.number(),
      comments: z.string(),
    }),
  ),
});
export type Interview = z.infer<typeof interviewSchema>;

/** A panel member's name as the server gave it on this interview, else their id. */
export function interviewerName(interview: Interview, employeeId: string) {
  return (
    interview.interviewers.find((i) => i.employeeId === employeeId)?.name ??
    employeeId
  );
}

/**
 * Rounds, oldest first. Pass `page` (and `pageSize`, at most 100) for one page (036 H4); without
 * `page` the server caps the list at 500. For a pager that needs the total, `getInterviewsPage`.
 */
export async function getInterviews(
  query: {
    candidateId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    /** `desc` for newest first (the Completed and Cancelled tabs). */
    order?: 'asc' | 'desc';
  } = {},
) {
  return z
    .array(interviewSchema)
    .parse(await authFetch(`/recruitment/interviews${qs({ ...query })}`));
}
/**
 * One page of rounds with the server's total (`X-Total-Count`). `total` is null only when the header
 * did not arrive, and a screen then falls back to "Next while a full page came back".
 */
export async function getInterviewsPage(query: {
  status?: string;
  page: number;
  pageSize: number;
  order?: 'asc' | 'desc';
}): Promise<{ items: Interview[]; total: number | null }> {
  const { data, headers } = await authFetchWithMeta<unknown>(
    `/recruitment/interviews${qs({ ...query })}`,
  );
  return {
    items: z.array(interviewSchema).parse(data),
    total: totalCountOf(headers),
  };
}

export interface ScheduleInterviewInput {
  roundNumber: number;
  roundType: string;
  scheduledAt: string;
  mode: string;
  interviewerEmployeeIds: string[];
  location?: string;
}
export async function scheduleInterview(
  candidateId: string,
  input: ScheduleInterviewInput,
) {
  return authFetch(`/recruitment/candidates/${candidateId}/interviews`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export async function submitInterviewFeedback(
  interviewId: string,
  input: {
    interviewerEmployeeId: string;
    outcome: string;
    score: number;
    comments: string;
  },
) {
  return authFetch(`/recruitment/interviews/${interviewId}/feedback`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
export async function rescheduleInterview(
  interviewId: string,
  input: { scheduledAt: string; reason: string },
) {
  return authFetch(`/recruitment/interviews/${interviewId}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// ── Offers ───────────────────────────────────────────────────────────────────

const offerSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  designationId: z.string(),
  departmentId: z.string(),
  offeredCtc: decimal,
  salaryBreakup: z
    .array(z.object({ name: z.string(), monthlyAmount: decimal }))
    .catch([]),
  proposedJoiningDate: z.string(),
  confirmedJoiningDate: z.string().nullable(),
  probationMonths: z.number(),
  noticePeriodDays: z.number(),
  reportingManagerEmployeeId: z.string(),
  outsideBudget: z.boolean(),
  status: z.enum(OFFER_STATUSES).catch('draft'),
  letterId: z.string().nullable(),
});
export type Offer = z.infer<typeof offerSchema>;

export async function getOffers(candidateId: string): Promise<Offer[]> {
  return z
    .array(offerSchema)
    .parse(await authFetch(`/recruitment/candidates/${candidateId}/offers`));
}
export interface OfferInput {
  designationId: string;
  departmentId: string;
  offeredCtc: number;
  salaryBreakup: { name: string; monthlyAmount: number }[];
  proposedJoiningDate: string;
  probationMonths: number;
  noticePeriodDays: number;
  reportingManagerEmployeeId: string;
}
export async function createOffer(
  candidateId: string,
  input: OfferInput,
): Promise<Offer> {
  return offerSchema.parse(
    await authFetch(`/recruitment/candidates/${candidateId}/offers`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}
/**
 * Issues a draft offer: renders its letter on the letterhead, moves the offer to issued, advances
 * the candidate and sets `letterId`.
 *
 * `variables` carries the letter's manual fields (duty hours) and any corrections to the pre-fill
 * from `GET /letters/prefill`; a required one left blank is refused with
 * `LETTER_REQUIRED_FIELD_UNRESOLVED` naming it in `fields`.
 */
export async function generateOffer(
  offerId: string,
  input: { variables?: Record<string, string>; signatoryId?: string } = {},
): Promise<Offer> {
  return offerSchema.parse(
    await authFetch(`/recruitment/offers/${offerId}/generate`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}
export async function acceptOffer(
  offerId: string,
  input: { acceptedOn: string; confirmedJoiningDate?: string },
): Promise<Offer> {
  return offerSchema.parse(
    await authFetch(`/recruitment/offers/${offerId}/accept`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}
export async function declineOffer(
  offerId: string,
  declineReason: string,
): Promise<Offer> {
  return offerSchema.parse(
    await authFetch(`/recruitment/offers/${offerId}/decline`, {
      method: 'PATCH',
      body: JSON.stringify({ declineReason }),
    }),
  );
}

// ── Joining & Onboarding ─────────────────────────────────────────────────────

export interface JoinInput {
  actualJoiningDate: string;
  dateOfBirth: string;
  gender: string;
  permanentAddress: string;
  emergencyContact: string;
  siteId?: string;
  shiftId?: string;
}
export async function joinCandidate(candidateId: string, input: JoinInput) {
  return authFetch<{
    employeeId: string;
    employeeCode: string;
    delayedJoining: boolean;
    delayedByDays: number;
    checklistId: string;
  }>(`/recruitment/candidates/${candidateId}/join`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

const onboardingSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  candidateId: z.string(),
  openedAt: z.string(),
  completedAt: z.string().nullable(),
  onboardingComplete: z.boolean(),
  completedCount: z.number(),
  totalCount: z.number(),
  items: z.array(
    z.object({
      id: z.string(),
      itemType: z.enum(['document', 'kit', 'induction']).catch('induction'),
      documentTypeId: z.string().nullable(),
      kitItemId: z.string().nullable(),
      label: z.string(),
      status: z.enum(['pending', 'completed', 'waived']).catch('pending'),
      completedAt: z.string().nullable(),
      waiverReason: z.string().nullable(),
      linkedIssueId: z.string().nullable(),
    }),
  ),
});
export type Onboarding = z.infer<typeof onboardingSchema>;

export async function getOnboarding(employeeId: string): Promise<Onboarding> {
  return onboardingSchema.parse(
    await authFetch(`/recruitment/onboarding/${employeeId}`),
  );
}
export async function verifyOnboardingDocument(
  itemId: string,
  input: { documentNumber?: string; expiryDate?: string; file: Blob },
): Promise<Onboarding> {
  const encoded = await blobToBase64(input.file);
  return onboardingSchema.parse(
    await authFetch(`/recruitment/onboarding/items/${itemId}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({
        documentNumber: input.documentNumber,
        expiryDate: input.expiryDate,
        file: encoded,
        contentType: input.file.type || 'application/pdf',
      }),
    }),
  );
}
export async function issueKitItem(
  itemId: string,
  quantity: number,
): Promise<Onboarding> {
  return onboardingSchema.parse(
    await authFetch(`/recruitment/onboarding/items/${itemId}/issue`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),
  );
}
export async function completeInduction(itemId: string): Promise<Onboarding> {
  return onboardingSchema.parse(
    await authFetch(
      `/recruitment/onboarding/items/${itemId}/complete-induction`,
      {
        method: 'PATCH',
      },
    ),
  );
}
export async function waiveOnboardingItem(
  itemId: string,
  reason: string,
): Promise<Onboarding> {
  return onboardingSchema.parse(
    await authFetch(`/recruitment/onboarding/items/${itemId}/waive`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  );
}

// ── Letters ──────────────────────────────────────────────────────────────────

/**
 * The template schema and its three functions moved to `app/lib/api/letters.ts` on 2026-10-03.
 *
 * They were not merely relocated. The schema here parsed `letterType` as
 * `z.enum(LETTER_TYPES).catch('offer')` — feature 011's five values, with a fallback — and 017
 * replaced that enum with `LetterKind` rows, fifteen of them. A template for any of the other ten
 * arrived with a key the enum rejected and **`.catch` relabelled it as an offer letter**: it was
 * listed as "Offer Letter", and saving an edit would have sent `letterType: "offer"` back, moving a
 * work-order template onto the offer kind. Silently, on save.
 *
 * Templates are 017's concern now — they are keyed to a letter kind and validated against the
 * fields that kind declares — so they live with the rest of the letter-kind client.
 */

const letterSchema = z.object({
  id: z.string(),
  /**
   * The kind's key, as a string.
   *
   * **Was `z.enum(LETTER_TYPES).catch('offer')`,** which relabelled a letter of any of 017's other
   * ten kinds as an offer letter — see the note above. `recruitmentLabel()` title-cases an unknown
   * key, so an honest string reads correctly where the coerced enum read wrongly.
   */
  letterType: z.string(),
  employeeId: z.string().nullable(),
  candidateId: z.string().nullable(),
  version: z.number(),
  isSuperseded: z.boolean(),
  issuedAt: z.string(),
});
export type GeneratedLetter = z.infer<typeof letterSchema>;

export async function getLetters(
  query: { employeeId?: string } = {},
): Promise<GeneratedLetter[]> {
  return z
    .array(letterSchema)
    .parse(await authFetch(`/recruitment/letters${qs({ ...query })}`));
}
export async function generateLetter(input: {
  letterType: string;
  employeeId: string;
}): Promise<GeneratedLetter> {
  return letterSchema.parse(
    await authFetch('/recruitment/letters', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}
export async function downloadLetter(id: string): Promise<Blob> {
  return authFetchBlob(`/recruitment/letters/${id}/download`);
}

// ── Resignations ─────────────────────────────────────────────────────────────

const resignationSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  resignationDate: z.string().nullable(),
  reasonCategory: z.enum(RESIGNATION_REASON_CATEGORIES).catch('other'),
  reasonDetail: z.string(),
  noticePeriodDays: z.number(),
  expectedLastWorkingDay: z.string().nullable(),
  agreedLastWorkingDay: z.string().nullable(),
  noticeWaiverDays: z.number().nullable(),
  status: z.enum(RESIGNATION_STATUSES).catch('submitted'),
  /** Resolved by the server (2026-10-15); optional so an older API still parses. */
  employeeCode: z.string().nullable().optional(),
  employeeName: z.string().nullable().optional(),
});
export type Resignation = z.infer<typeof resignationSchema>;

export async function getResignations(
  query: { status?: string } = {},
): Promise<Resignation[]> {
  return z
    .array(resignationSchema)
    .parse(await authFetch(`/recruitment/resignations${qs({ ...query })}`));
}
export interface ResignationInput {
  /**
   * The company the write belongs to.
   *
   * **No longer sent by any screen** (019 FR-004). The backend derives it from the
   * caller's session: `companyScope()` resolves a cross-company caller who has selected
   * a company to that company, and a caller pinned to one company to their own.
   *
   * It stays on the type because the backend still accepts it, and because the case it
   * covered is now handled better by refusing: a cross-company Super Admin with no
   * selection gets an explicit "companyId is required", where the retired
   * `CompanyProvider` silently supplied whichever company sorted first — so a record
   * could be created against a company nobody chose.
   */
  companyId?: string;
  employeeId: string;
  resignationDate: string;
  reasonCategory: string;
  reasonDetail: string;
  noticePeriodDays: number;
}
export async function createResignation(
  input: ResignationInput,
): Promise<Resignation> {
  return resignationSchema.parse(
    await authFetch('/recruitment/resignations', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}
export async function acceptResignation(
  id: string,
  input: {
    agreedLastWorkingDay?: string;
    noticeWaiverDays?: number;
    waiverReason?: string;
  },
): Promise<Resignation> {
  return resignationSchema.parse(
    await authFetch(`/recruitment/resignations/${id}/accept`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}
export async function withdrawResignation(
  id: string,
  reason: string,
): Promise<Resignation> {
  return resignationSchema.parse(
    await authFetch(`/recruitment/resignations/${id}/withdraw`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────

export async function getNewJoinings(query: {
  from: string;
  to: string;
  departmentId?: string;
  projectId?: string;
}) {
  return authFetch<{
    items: {
      candidateId: string;
      employeeId: string | null;
      name: string;
      requisitionCode: string;
      source: string;
      offeredCtc: number | null;
      joiningDate: string | null;
    }[];
  }>(`/recruitment/reports/new-joinings${qs({ ...query })}`);
}
/** `from`/`to` (`YYYY-MM-DD`, inclusive) bound the candidates' application date (036 H5). */
export async function getFunnelReport(
  query: { requisitionId?: string; from?: string; to?: string } = {},
) {
  return authFetch<{
    stageCounts: Record<string, number>;
    conversions: { from: string; to: string; percent: number }[];
    averageTimeToHireDays: number | null;
    sourceBreakdown: { source: string; count: number }[];
  }>(`/recruitment/reports/funnel${qs({ ...query })}`);
}
export async function getResignationReport(query: {
  from: string;
  to: string;
  departmentId?: string;
  headcount?: number;
}) {
  return authFetch<{
    totalSeparations: number;
    reasonCounts: { reason: string; count: number }[];
    attritionRatePercent: number | null;
    items: {
      employeeId: string;
      /** Since 036 follow-up; null for an employee the caller cannot read. */
      employeeCode?: string | null;
      employeeName?: string | null;
      resignationDate: string;
      lastWorkingDay: string;
      tenureMonths: number | null;
      reasonCategory: string;
      settlementPending: boolean;
    }[];
  }>(`/recruitment/reports/resignations${qs({ ...query })}`);
}
