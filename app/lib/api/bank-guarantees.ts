import { z } from 'zod';

import type { StoredFile } from '@/app/lib/api/client';
import { authFetch, authFetchFile } from '@/app/lib/session';

/**
 * Every `/projects/bank-guarantees` call (037, buildcore-api specs/037-bank-guarantees/spec.md).
 *
 * Principle V: no component issues its own `fetch()`, and every response is parsed before the
 * app trusts it. Amounts travel as strings — the api's columns are `Decimal(16,2)`.
 */

export const BG_TYPES = ['EMD', 'PBG'] as const;
export type BgType = (typeof BG_TYPES)[number];

export const BG_DISPLAY_STATUSES = ['RUNNING', 'EXPIRED', 'RELEASED', 'ENCASHED'] as const;
export type BgDisplayStatus = (typeof BG_DISPLAY_STATUSES)[number];

export const BG_STATUS_FILTERS = [
  'expiring',
  'running',
  'expired',
  'released',
  'encashed',
] as const;
export type BgStatusFilter = (typeof BG_STATUS_FILTERS)[number];

const guaranteeSummarySchema = z.object({
  id: z.string(),
  tenderId: z.string(),
  type: z.enum(BG_TYPES),
  bgNumber: z.string().nullable(),
  amount: z.string(),
  issueDate: z.string().nullable(),
  expiryDate: z.string().nullable(),
  claimPeriodEndDate: z.string().nullable(),
  issuingBank: z.string().nullable(),
  issuingBranch: z.string().nullable(),
  marginAmount: z.string().nullable(),
  fdReference: z.string().nullable(),
  status: z.enum(['RUNNING', 'RELEASED', 'ENCASHED']),
  displayStatus: z.enum(BG_DISPLAY_STATUSES),
  daysToExpiry: z.number().nullable(),
  releasedOn: z.string().nullable(),
  encashedOn: z.string().nullable(),
  encashedAmount: z.string().nullable(),
  remarks: z.string().nullable(),
});

const documentSchema = z.object({
  id: z.string(),
  title: z.string(),
  fileName: z.string().nullable(),
  contentType: z.string(),
  sizeBytes: z.number(),
  uploadedAt: z.string(),
  uploadedByName: z.string().nullable(),
});
export type BgDocument = z.infer<typeof documentSchema>;

const eventSchema = z.object({
  id: z.string(),
  kind: z.string(),
  fromDate: z.string().nullable(),
  toDate: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  actorName: z.string().nullable(),
});
export type BgEvent = z.infer<typeof eventSchema>;

const guaranteeDetailSchema = guaranteeSummarySchema.extend({
  documents: z.array(documentSchema),
  events: z.array(eventSchema),
});
export type BankGuarantee = z.infer<typeof guaranteeDetailSchema>;

const tenderBase = {
  id: z.string(),
  companyId: z.string(),
  serialNo: z.number(),
  workName: z.string(),
  departmentName: z.string(),
  tenderAmount: z.string().nullable(),
  projectId: z.string().nullable(),
  projectName: z.string().nullable(),
  remarks: z.string().nullable(),
};

const tenderListItemSchema = z.object({
  ...tenderBase,
  guarantees: z.array(guaranteeSummarySchema.extend({ documentCount: z.number() })),
});
export type BgTenderListItem = z.infer<typeof tenderListItemSchema>;
export type BgGuaranteeSummary = BgTenderListItem['guarantees'][number];

const tenderSchema = z.object({
  ...tenderBase,
  guarantees: z.array(guaranteeDetailSchema),
});
export type BgTender = z.infer<typeof tenderSchema>;

const pageSchema = z.object({
  items: z.array(tenderListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export interface BgListQuery {
  search?: string;
  status?: BgStatusFilter | '';
  projectId?: string;
  page?: number;
  pageSize?: number;
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

const BASE = '/projects/bank-guarantees';

export async function listBgTenders(query: BgListQuery) {
  return pageSchema.parse(await authFetch<unknown>(`${BASE}${qs({ ...query })}`));
}

export async function getBgTender(id: string): Promise<BgTender> {
  return tenderSchema.parse(await authFetch<unknown>(`${BASE}/${id}`));
}

export interface BgTenderInput {
  workName: string;
  departmentName: string;
  tenderAmount?: string | null;
  projectId?: string | null;
  remarks?: string | null;
}

export async function createBgTender(input: BgTenderInput): Promise<BgTender> {
  return tenderSchema.parse(
    await authFetch<unknown>(BASE, { method: 'POST', body: JSON.stringify(input) }),
  );
}

export async function updateBgTender(id: string, input: Partial<BgTenderInput>) {
  return tenderSchema.parse(
    await authFetch<unknown>(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  );
}

export async function deleteBgTender(id: string): Promise<void> {
  await authFetch<unknown>(`${BASE}/${id}`, { method: 'DELETE' });
}

export interface BankGuaranteeInput {
  type: BgType;
  bgNumber?: string | null;
  amount: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  claimPeriodEndDate?: string | null;
  issuingBank?: string | null;
  issuingBranch?: string | null;
  marginAmount?: string | null;
  fdReference?: string | null;
  remarks?: string | null;
}

/** Each write answers with the whole tender, so the page re-renders from one response. */
async function tenderWrite(path: string, method: string, body?: unknown): Promise<BgTender> {
  return tenderSchema.parse(
    await authFetch<unknown>(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
}

export const createBankGuarantee = (tenderId: string, input: BankGuaranteeInput) =>
  tenderWrite(`${BASE}/${tenderId}/guarantees`, 'POST', input);

export const updateBankGuarantee = (id: string, input: Partial<Omit<BankGuaranteeInput, 'type'>>) =>
  tenderWrite(`${BASE}/guarantees/${id}`, 'PATCH', input);

export const deleteBankGuarantee = (id: string) =>
  tenderWrite(`${BASE}/guarantees/${id}`, 'DELETE');

export const extendBankGuarantee = (
  id: string,
  input: { expiryDate: string; claimPeriodEndDate?: string | null; note?: string },
) => tenderWrite(`${BASE}/guarantees/${id}/extend`, 'POST', input);

export const releaseBankGuarantee = (id: string, input: { releasedOn: string; note?: string }) =>
  tenderWrite(`${BASE}/guarantees/${id}/release`, 'POST', input);

export const encashBankGuarantee = (
  id: string,
  input: { encashedOn: string; encashedAmount: string; note?: string },
) => tenderWrite(`${BASE}/guarantees/${id}/encash`, 'POST', input);

export const reopenBankGuarantee = (id: string, note: string) =>
  tenderWrite(`${BASE}/guarantees/${id}/reopen`, 'POST', { note });

export const uploadBankGuaranteeDocument = (
  id: string,
  input: { title: string; data: string; contentType: string; fileName?: string },
) => tenderWrite(`${BASE}/guarantees/${id}/documents`, 'POST', input);

export const deleteBankGuaranteeDocument = (documentId: string) =>
  tenderWrite(`${BASE}/documents/${documentId}`, 'DELETE');

export function getBankGuaranteeDocument(documentId: string): Promise<StoredFile> {
  return authFetchFile(`${BASE}/documents/${documentId}/file`);
}

/** The client's "TENDER BG DETAILS" sheet, with the register's filters. */
export async function downloadBgRegister(
  query: Omit<BgListQuery, 'page' | 'pageSize'>,
): Promise<{ blob: Blob; filename: string }> {
  const { blob, filename } = await authFetchFile(`${BASE}/export.xlsx${qs({ ...query })}`);
  return { blob, filename: filename ?? 'Tender BG Details.xlsx' };
}
