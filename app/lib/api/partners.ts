import { z } from 'zod';

import {
  BOCW_STATUSES,
  CONTRACTOR_COMPLIANCE_STATUSES,
  CONTRACTOR_DOCUMENT_TYPES,
  MONTHLY_COMPLIANCE_STATUSES,
  RAG_CELL_STATUSES,
  VENDOR_TYPES,
} from '@/app/lib/constants';
import { authFetch } from '@/app/lib/session';

/**
 * Every `/dashboard/partners/*` call to `buildcore-api` (feature 007).
 *
 * One module per domain, per Constitution Principle V — no component issues its own
 * `fetch()`. Every response is parsed through a `zod` schema before the app trusts
 * it (Principle IV), and the `z.infer` type is what the UI consumes.
 *
 * **Every schema below was written from a response the running API actually
 * returned**, not from `data-model.md` and not from the Prisma models. Feature 005
 * shipped six bugs of exactly one kind by doing the opposite: schemas that named
 * `id` where the API sent `punchId`, `days` where it sent `dayCount`, `period` where
 * it sent `month`. Each rejected a valid `200` and surfaced as "Could not load this
 * list", and each cost a round of screenshots to find. The one shape here that no
 * live call could produce — a BOCW row, because the projects module it reads from is
 * not built — is pinned by a backend unit test instead (`bocw.service.spec.ts`).
 *
 * Schemas validate the fields the UI reads and let `zod` strip the rest, the same
 * choice `hr-payroll.ts` documents: several routes return full Prisma rows, and
 * enumerating every column would duplicate `schema.prisma` and go stale on the first
 * migration.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A money or rate value on the wire.
 *
 * Prisma `Decimal` columns can serialise as strings while a service-computed figure
 * arrives as a number — the same field differs by which route produced it. Coercing
 * here means no component has to know which is which.
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

const isoDate = z.string();
const nullableIsoDate = z.string().nullable();

const enumOf = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values);

function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor categories
// ─────────────────────────────────────────────────────────────────────────────

export const vendorCategorySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: isoDate,
  // Present on every response from the partners-side controller, which composes the
  // count with the settings-owned row.
  vendorCount: z.number(),
});
export type VendorCategory = z.infer<typeof vendorCategorySchema>;

export async function getVendorCategories(): Promise<VendorCategory[]> {
  const raw = await authFetch<unknown>('/partners/vendor-categories');
  return z.array(vendorCategorySchema).parse(raw);
}

export async function createVendorCategory(input: {
  name: string;
  description?: string;
}): Promise<VendorCategory> {
  const raw = await authFetch<unknown>('/partners/vendor-categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return vendorCategorySchema.parse(raw);
}

export async function updateVendorCategory(
  id: string,
  input: { name?: string; description?: string },
): Promise<VendorCategory> {
  const raw = await authFetch<unknown>(`/partners/vendor-categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return vendorCategorySchema.parse(raw);
}

/** Returns 204 with no body; a 409 means vendors still deal in this category. */
export async function deleteVendorCategory(id: string): Promise<void> {
  await authFetch<unknown>(`/partners/vendor-categories/${id}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendors
// ─────────────────────────────────────────────────────────────────────────────

export const vendorContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});
export type VendorContact = z.infer<typeof vendorContactSchema>;

export const vendorHireDetailSchema = z.object({
  hireType: z.enum(['taken', 'given']),
  contractCode: z.string().nullable(),
  periodFrom: nullableIsoDate,
  periodTo: nullableIsoDate,
  machineCategory: z.string().nullable(),
  machineName: z.string().nullable(),
  requiredAvg: nullableDecimal,
  chargesBase: z.enum(['monthly', 'daily']),
  rate: nullableDecimal,
  minWorkingDays: z.number().nullable(),
  allowBdDays: z.boolean(),
  allowIdleDays: z.boolean(),
  operatorCharges: nullableDecimal,
  helperCharges: nullableDecimal,
  maintenanceCharges: nullableDecimal,
  fuelCharges: nullableDecimal,
  termsAndConditions: z.string().nullable(),
  requirements: z.string().nullable(),
});
export type VendorHireDetail = z.infer<typeof vendorHireDetailSchema>;

/** The list row. Deliberately narrower than the detail: the backend's list query
 * selects a primary contact and category ids and nothing else, so asking for more
 * here would reject a valid response. */
export const vendorListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: enumOf(VENDOR_TYPES),
  gstin: z.string().nullable(),
  active: z.boolean(),
  city: z.string().nullable(),
  primaryContact: z
    .object({ name: z.string(), phone: z.string().nullable() })
    .nullable(),
  categoryIds: z.array(z.string()),
});
export type VendorListItem = z.infer<typeof vendorListItemSchema>;

export const vendorDetailSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  type: enumOf(VENDOR_TYPES),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  tdsSection: z.string().nullable(),
  tdsRate: nullableDecimal,
  active: z.boolean(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pinCode: z.string().nullable(),
  vendorCurrency: z.string(),
  exchangeRate: decimal,
  contacts: z.array(vendorContactSchema),
  categoryIds: z.array(z.string()),
  hireDetail: vendorHireDetailSchema.nullable(),
  // Only the by-id route includes this, and only when a profile exists — so it is
  // optional AND nullable. Requiring it would reject every create response.
  contractor: z
    .object({
      id: z.string(),
      complianceStatus: enumOf(CONTRACTOR_COMPLIANCE_STATUSES),
    })
    .nullable()
    .optional(),
});
export type VendorDetail = z.infer<typeof vendorDetailSchema>;

export const vendorPageSchema = z.object({
  items: z.array(vendorListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type VendorPage = z.infer<typeof vendorPageSchema>;

export interface VendorQuery {
  search?: string;
  type?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export async function getVendors(query: VendorQuery = {}): Promise<VendorPage> {
  const raw = await authFetch<unknown>(`/partners/vendors${qs({ ...query })}`);
  return vendorPageSchema.parse(raw);
}

export async function getVendor(id: string): Promise<VendorDetail> {
  const raw = await authFetch<unknown>(`/partners/vendors/${id}`);
  return vendorDetailSchema.parse(raw);
}

export interface VendorInput {
  name: string;
  type: string;
  gstin?: string;
  pan?: string;
  tdsSection?: string;
  tdsRate?: number;
  active?: boolean;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  contacts?: Array<{ name: string; phone?: string; email?: string }>;
  categoryIds?: string[];
  hireDetail?: Record<string, unknown>;
}

export async function createVendor(input: VendorInput): Promise<VendorDetail> {
  const raw = await authFetch<unknown>('/partners/vendors', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return vendorDetailSchema.parse(raw);
}

/**
 * Sending `contacts` or `categoryIds` REPLACES the stored list wholesale — omit the
 * field to leave it alone, send `[]` to clear it. The backend does this in one
 * transaction; the caller must send the list it wants to end up with.
 */
export async function updateVendor(
  id: string,
  input: Partial<VendorInput>,
): Promise<VendorDetail> {
  const raw = await authFetch<unknown>(`/partners/vendors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return vendorDetailSchema.parse(raw);
}

export async function setVendorActive(
  id: string,
  active: boolean,
): Promise<VendorDetail> {
  return updateVendor(id, { active });
}

export const vendorTdsSchema = z.object({
  tdsSection: z.string().nullable(),
  tdsRate: nullableDecimal,
});

export async function getVendorTds(id: string) {
  const raw = await authFetch<unknown>(`/partners/vendors/${id}/tds`);
  return vendorTdsSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Contractors
// ─────────────────────────────────────────────────────────────────────────────

export const contractorDocumentSchema = z.object({
  id: z.string(),
  documentType: enumOf(CONTRACTOR_DOCUMENT_TYPES),
  fileName: z.string().nullable(),
  expiresAt: nullableIsoDate,
  expiryWarning: z.boolean(),
  uploadedAt: isoDate,
});
export type ContractorDocument = z.infer<typeof contractorDocumentSchema>;

export const contractorSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  vendorId: z.string(),
  licenceNumber: z.string().nullable(),
  pfRegistration: z.string().nullable(),
  esicRegistration: z.string().nullable(),
  bocwRegistration: z.string().nullable(),
  insurancePolicyNumber: z.string().nullable(),
  complianceStatus: enumOf(CONTRACTOR_COMPLIANCE_STATUSES),
  createdAt: isoDate,
  vendorName: z.string().nullable(),
  vendorCode: z.string().nullable(),
  vendorType: z.string().nullable(),
  // The list includes a document count; the detail route includes the documents
  // themselves instead. Both optional, because neither route sends both.
  documentCount: z.number().optional(),
  documents: z.array(contractorDocumentSchema).optional(),
});
export type Contractor = z.infer<typeof contractorSchema>;

export async function getContractors(query: {
  complianceStatus?: string;
} = {}): Promise<Contractor[]> {
  const raw = await authFetch<unknown>(`/partners/contractors${qs({ ...query })}`);
  return z.array(contractorSchema).parse(raw);
}

export async function getContractor(id: string): Promise<Contractor> {
  const raw = await authFetch<unknown>(`/partners/contractors/${id}`);
  return contractorSchema.parse(raw);
}

export interface ContractorInput {
  vendorId: string;
  licenceNumber?: string;
  pfRegistration?: string;
  esicRegistration?: string;
  bocwRegistration?: string;
  insurancePolicyNumber?: string;
}

export async function createContractor(
  input: ContractorInput,
): Promise<Contractor> {
  const raw = await authFetch<unknown>('/partners/contractors', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return contractorSchema.parse(raw);
}

export async function updateContractor(
  id: string,
  input: Omit<Partial<ContractorInput>, 'vendorId'>,
): Promise<Contractor> {
  const raw = await authFetch<unknown>(`/partners/contractors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return contractorSchema.parse(raw);
}

export async function uploadContractorDocument(
  contractorId: string,
  input: {
    documentType: string;
    /** Base64 content, without a data: prefix. */
    file: string;
    fileName?: string;
    contentType?: string;
    expiresAt?: string;
  },
): Promise<ContractorDocument> {
  const raw = await authFetch<unknown>(
    `/partners/contractors/${contractorId}/documents`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return contractorDocumentSchema.parse(raw);
}

export async function deleteContractorDocument(documentId: string): Promise<void> {
  await authFetch<unknown>(`/partners/contractors/documents/${documentId}`, {
    method: 'DELETE',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Monthly compliance
// ─────────────────────────────────────────────────────────────────────────────

export const complianceSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  contractorProfileId: z.string(),
  month: z.string(),
  pfChallanNumber: z.string().nullable(),
  pfAmount: nullableDecimal,
  pfDate: nullableIsoDate,
  esicChallanNumber: z.string().nullable(),
  esicAmount: nullableDecimal,
  esicDate: nullableIsoDate,
  status: enumOf(MONTHLY_COMPLIANCE_STATUSES),
  verifiedByUserId: z.string().nullable(),
  verifiedAt: nullableIsoDate,
  createdAt: isoDate,
  // The list route joins the contractor's vendor for a name column; the write routes
  // return the bare record. Optional, or every create would fail to parse.
  contractorName: z.string().optional(),
  contractorCode: z.string().optional(),
});
export type MonthlyCompliance = z.infer<typeof complianceSchema>;

export async function getCompliance(
  query: { contractorProfileId?: string; month?: string } = {},
): Promise<MonthlyCompliance[]> {
  const raw = await authFetch<unknown>(`/partners/compliance${qs({ ...query })}`);
  return z.array(complianceSchema).parse(raw);
}

export interface ComplianceInput {
  contractorProfileId: string;
  month: string;
  pfChallanNumber?: string;
  pfAmount?: number;
  pfDate?: string;
  esicChallanNumber?: string;
  esicAmount?: number;
  esicDate?: string;
}

export async function createCompliance(
  input: ComplianceInput,
): Promise<MonthlyCompliance> {
  const raw = await authFetch<unknown>('/partners/compliance', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return complianceSchema.parse(raw);
}

export async function updateCompliance(
  id: string,
  input: Omit<Partial<ComplianceInput>, 'contractorProfileId' | 'month'>,
): Promise<MonthlyCompliance> {
  const raw = await authFetch<unknown>(`/partners/compliance/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return complianceSchema.parse(raw);
}

/** Only a `submitted` record can be verified, and a verified one is then immutable —
 * the backend answers 409 in both wrong cases. */
export async function verifyCompliance(id: string): Promise<MonthlyCompliance> {
  const raw = await authFetch<unknown>(`/partners/compliance/${id}/verify`, {
    method: 'PATCH',
  });
  return complianceSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// RAG matrix
// ─────────────────────────────────────────────────────────────────────────────

export const ragMatrixSchema = z.object({
  fy: z.string(),
  months: z.array(z.string()),
  rows: z.array(
    z.object({
      contractorProfileId: z.string(),
      contractorName: z.string(),
      cells: z.array(
        z.object({
          month: z.string(),
          status: enumOf(RAG_CELL_STATUSES),
          complianceId: z.string().nullable(),
        }),
      ),
    }),
  ),
});
export type RagMatrix = z.infer<typeof ragMatrixSchema>;

export async function getRagMatrix(fy: string): Promise<RagMatrix> {
  const raw = await authFetch<unknown>(`/partners/rag${qs({ fy })}`);
  return ragMatrixSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOCW cess
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A cess row. This is the one shape in this file no live call could produce — the
 * projects module it reads from is not built, so the list always comes back empty
 * today. It is pinned by `bocw.service.spec.ts` in the API instead of guessed.
 */
export const bocwRowSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  contractValue: decimal,
  cessRate: decimal,
  cessLiability: decimal,
  totalPaid: decimal,
  balance: decimal,
  status: enumOf(BOCW_STATUSES),
});
export type BocwRow = z.infer<typeof bocwRowSchema>;

export const bocwListSchema = z.object({
  cessRate: decimal,
  rows: z.array(bocwRowSchema),
  /** Modules this view needs but cannot reach. Today always `['projects']`. */
  unavailableModules: z.array(z.string()),
});
export type BocwList = z.infer<typeof bocwListSchema>;

export const bocwPaymentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  amountPaid: decimal,
  paymentDate: isoDate,
  referenceNumber: z.string(),
  remarks: z.string().nullable(),
  createdAt: isoDate,
});
export type BocwPayment = z.infer<typeof bocwPaymentSchema>;

export async function getBocw(): Promise<BocwList> {
  const raw = await authFetch<unknown>('/partners/bocw');
  return bocwListSchema.parse(raw);
}

export async function getBocwPayments(projectId: string): Promise<BocwPayment[]> {
  const raw = await authFetch<unknown>(`/partners/bocw/${projectId}/payments`);
  return z.array(bocwPaymentSchema).parse(raw);
}

export async function recordBocwPayment(
  projectId: string,
  input: {
    amountPaid: number;
    paymentDate: string;
    referenceNumber: string;
    remarks?: string;
  },
): Promise<BocwPayment> {
  const raw = await authFetch<unknown>(`/partners/bocw/${projectId}/payments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return bocwPaymentSchema.parse(raw);
}
