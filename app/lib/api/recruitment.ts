import { z } from 'zod';

import {
  CANDIDATE_SOURCES,
  CANDIDATE_STAGES,
  INTERVIEW_MODES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_ROUND_TYPES,
  LETTER_TYPES,
  OFFER_STATUSES,
  REQUISITION_EMPLOYMENT_TYPES,
  REQUISITION_STATUSES,
  RESIGNATION_REASON_CATEGORIES,
  RESIGNATION_STATUSES,
} from '@/app/lib/constants';
import { authFetch, authFetchBlob } from '@/app/lib/session';

/**
 * Every `/recruitment/*` and `/recruitment/letter-templates` call to `buildcore-api`
 * (feature 011). One module per domain (Principle V); every response validated with a
 * `zod` schema at the boundary (Principle IV). Candidate stage/status enums use
 * `.catch` so an unknown value renders rather than throwing (spec FR-025).
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

function qs(params: Record<string, string | number | boolean | undefined | null>) {
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
  return requisitionSchema.parse(await authFetch(`/recruitment/requisitions/${id}`));
}
export interface RequisitionInput {
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
export async function createRequisition(input: RequisitionInput): Promise<Requisition> {
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
export async function submitRequisitionForApproval(id: string): Promise<Requisition> {
  return requisitionSchema.parse(await reqAction(id, 'submit'));
}
export async function rejectRequisition(id: string, reason: string): Promise<Requisition> {
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
export async function getCandidates(query: CandidateQuery = {}): Promise<CandidatePage> {
  return candidatePageSchema.parse(
    await authFetch(`/recruitment/candidates${qs({ ...query, pageSize: query.pageSize ?? 200 })}`),
  );
}
/** Unmasked detail — never cache the result (spec FR-006). */
export async function getCandidate(id: string): Promise<CandidateDetail> {
  return candidateDetailSchema.parse(await authFetch(`/recruitment/candidates/${id}`));
}
export interface CandidateInput {
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
    body: JSON.stringify({ file: encoded, contentType: file.type || 'application/pdf' }),
  });
}
export async function transitionStage(id: string, stage: string, remarks?: string) {
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

export async function getInterviews(query: { candidateId?: string; status?: string } = {}) {
  return z.array(interviewSchema).parse(await authFetch(`/recruitment/interviews${qs({ ...query })}`));
}
export interface ScheduleInterviewInput {
  roundNumber: number;
  roundType: string;
  scheduledAt: string;
  mode: string;
  interviewerEmployeeIds: string[];
  location?: string;
}
export async function scheduleInterview(candidateId: string, input: ScheduleInterviewInput) {
  return authFetch(`/recruitment/candidates/${candidateId}/interviews`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export async function submitInterviewFeedback(
  interviewId: string,
  input: { interviewerEmployeeId: string; outcome: string; score: number; comments: string },
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
  return z.array(offerSchema).parse(
    await authFetch(`/recruitment/candidates/${candidateId}/offers`),
  );
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
export async function createOffer(candidateId: string, input: OfferInput): Promise<Offer> {
  return offerSchema.parse(
    await authFetch(`/recruitment/candidates/${candidateId}/offers`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}
export async function generateOffer(offerId: string): Promise<Offer> {
  return offerSchema.parse(
    await authFetch(`/recruitment/offers/${offerId}/generate`, { method: 'POST' }),
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
export async function declineOffer(offerId: string, declineReason: string): Promise<Offer> {
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
  return onboardingSchema.parse(await authFetch(`/recruitment/onboarding/${employeeId}`));
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
export async function issueKitItem(itemId: string, quantity: number): Promise<Onboarding> {
  return onboardingSchema.parse(
    await authFetch(`/recruitment/onboarding/items/${itemId}/issue`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),
  );
}
export async function completeInduction(itemId: string): Promise<Onboarding> {
  return onboardingSchema.parse(
    await authFetch(`/recruitment/onboarding/items/${itemId}/complete-induction`, {
      method: 'PATCH',
    }),
  );
}
export async function waiveOnboardingItem(itemId: string, reason: string): Promise<Onboarding> {
  return onboardingSchema.parse(
    await authFetch(`/recruitment/onboarding/items/${itemId}/waive`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  );
}

// ── Letters ──────────────────────────────────────────────────────────────────

const letterTemplateSchema = z.object({
  id: z.string(),
  letterType: z.enum(LETTER_TYPES).catch('offer'),
  name: z.string(),
  bodyTemplate: z.string(),
  letterheadAssetId: z.string().nullable(),
  isActive: z.boolean(),
});
export type LetterTemplate = z.infer<typeof letterTemplateSchema>;

export async function getLetterTemplates(): Promise<LetterTemplate[]> {
  return z.array(letterTemplateSchema).parse(await authFetch('/recruitment/letter-templates'));
}
export interface LetterTemplateInput {
  letterType: string;
  name: string;
  bodyTemplate: string;
  isActive?: boolean;
}
export async function createLetterTemplate(input: LetterTemplateInput): Promise<LetterTemplate> {
  return letterTemplateSchema.parse(
    await authFetch('/recruitment/letter-templates', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}
export async function updateLetterTemplate(
  id: string,
  input: Partial<LetterTemplateInput>,
): Promise<LetterTemplate> {
  return letterTemplateSchema.parse(
    await authFetch(`/recruitment/letter-templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

const letterSchema = z.object({
  id: z.string(),
  letterType: z.enum(LETTER_TYPES).catch('offer'),
  employeeId: z.string().nullable(),
  candidateId: z.string().nullable(),
  version: z.number(),
  isSuperseded: z.boolean(),
  issuedAt: z.string(),
});
export type GeneratedLetter = z.infer<typeof letterSchema>;

export async function getLetters(query: { employeeId?: string } = {}): Promise<GeneratedLetter[]> {
  return z.array(letterSchema).parse(await authFetch(`/recruitment/letters${qs({ ...query })}`));
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
});
export type Resignation = z.infer<typeof resignationSchema>;

export async function getResignations(query: { status?: string } = {}): Promise<Resignation[]> {
  return z.array(resignationSchema).parse(
    await authFetch(`/recruitment/resignations${qs({ ...query })}`),
  );
}
export interface ResignationInput {
  employeeId: string;
  resignationDate: string;
  reasonCategory: string;
  reasonDetail: string;
  noticePeriodDays: number;
}
export async function createResignation(input: ResignationInput): Promise<Resignation> {
  return resignationSchema.parse(
    await authFetch('/recruitment/resignations', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}
export async function acceptResignation(
  id: string,
  input: { agreedLastWorkingDay?: string; noticeWaiverDays?: number; waiverReason?: string },
): Promise<Resignation> {
  return resignationSchema.parse(
    await authFetch(`/recruitment/resignations/${id}/accept`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}
export async function withdrawResignation(id: string, reason: string): Promise<Resignation> {
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
export async function getFunnelReport(query: { requisitionId?: string } = {}) {
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
      resignationDate: string;
      lastWorkingDay: string;
      tenureMonths: number | null;
      reasonCategory: string;
      settlementPending: boolean;
    }[];
  }>(`/recruitment/reports/resignations${qs({ ...query })}`);
}
