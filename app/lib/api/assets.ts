import { z } from 'zod';

import {
  ASSET_ALLOCATION_STATUSES,
  ASSET_STATUSES,
  ASSET_TRACKING_MODES,
} from '@/app/lib/constants';
import { authFetch, authFetchBlob } from '@/app/lib/session';

/**
 * Every `/dashboard/assets/*` call to `buildcore-api` (feature 012).
 *
 * One module per domain, per Constitution Principle V — no component issues its own
 * `fetch()`. Every response is parsed through a `zod` schema before the app trusts it
 * (Principle IV), and the `z.infer` type is what the UI consumes.
 *
 * **Every schema below was checked against a response the running API actually
 * returned**, not against `data-model.md` and not against the Prisma models. Feature
 * 005 shipped six bugs of exactly one kind by doing the opposite, and 008 caught a
 * string-vs-number `contractValue` the same way.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

const decimal = z
  .union([z.number(), z.string()])
  .transform((v) =>
    typeof v === 'number' ? v : v.trim() === '' ? NaN : Number(v),
  )
  .refine((v) => !Number.isNaN(v), { message: 'Not a number' });

const isoDate = z.string();
const nullableDate = z.string().nullable();

/**
 * An enum the UI renders but does not branch on.
 *
 * `.catch()` rather than a hard `z.enum`: the backend's status set grows a value
 * before this client learns about it every time a feature ships, and a parse failure
 * would blank the whole register over one unrecognised row. The fallback keeps the
 * raw value, so the badge renders it neutrally with its own text rather than
 * pretending it is something else (spec FR-026).
 */
function openEnum<T extends readonly [string, ...string[]]>(_values: T) {
  // `_values` is carried for its *type* only — it is what narrows the inferred union
  // so a component can still switch on the known members. Nothing validates against
  // it at runtime, which is the whole point.
  return z.string().catch((ctx) => String(ctx.input)) as unknown as z.ZodType<
    T[number] | (string & {})
  >;
}

function qs(
  params: Record<string, string | number | boolean | undefined | null>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/** The page envelope every paginated assets list returns. */
function pageOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  });
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
  companyId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset categories (a settings master on an /assets route)
// ─────────────────────────────────────────────────────────────────────────────

export const assetCategorySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  trackingMode: openEnum(ASSET_TRACKING_MODES),
  depreciationRatePercent: decimal,
  usefulLifeYears: z.number(),
  custodyRequired: z.boolean(),
  inspectionRequired: z.boolean(),
  inspectionIntervalDays: z.number().nullable(),
  repairCostThresholdPercent: decimal,
  active: z.boolean(),
  /** Filled in by the API from the assets schema; drives whether tracking mode is
   * still editable and whether Delete is offered at all. */
  assetCount: z.number(),
  totalBookValue: decimal,
});
export type AssetCategory = z.infer<typeof assetCategorySchema>;

export interface AssetCategoryInput {
  name: string;
  trackingMode?: string;
  depreciationRatePercent?: number;
  usefulLifeYears?: number;
  custodyRequired?: boolean;
  inspectionRequired?: boolean;
  inspectionIntervalDays?: number;
  repairCostThresholdPercent?: number;
  active?: boolean;
}

export async function getAssetCategories(
  companyId?: string,
): Promise<AssetCategory[]> {
  const raw = await authFetch<unknown>(`/assets/categories${qs({ companyId })}`);
  return z.array(assetCategorySchema).parse(raw);
}

export async function createAssetCategory(
  input: AssetCategoryInput,
  companyId?: string,
): Promise<AssetCategory> {
  const raw = await authFetch<unknown>(`/assets/categories${qs({ companyId })}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return assetCategorySchema.parse(raw);
}

export async function updateAssetCategory(
  id: string,
  input: Partial<AssetCategoryInput>,
): Promise<AssetCategory> {
  const raw = await authFetch<unknown>(`/assets/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return assetCategorySchema.parse(raw);
}

export async function deleteAssetCategory(id: string): Promise<void> {
  await authFetch<void>(`/assets/categories/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset document types
// ─────────────────────────────────────────────────────────────────────────────

export const assetDocTypeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  alertDays: z.number(),
  active: z.boolean(),
});
export type AssetDocType = z.infer<typeof assetDocTypeSchema>;

export interface AssetDocTypeInput {
  name: string;
  alertDays?: number;
  active?: boolean;
}

export async function getAssetDocTypes(
  companyId?: string,
): Promise<AssetDocType[]> {
  const raw = await authFetch<unknown>(`/assets/doc-types${qs({ companyId })}`);
  return z.array(assetDocTypeSchema).parse(raw);
}

export async function createAssetDocType(
  input: AssetDocTypeInput,
  companyId?: string,
): Promise<AssetDocType> {
  const raw = await authFetch<unknown>(`/assets/doc-types${qs({ companyId })}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return assetDocTypeSchema.parse(raw);
}

export async function updateAssetDocType(
  id: string,
  input: Partial<AssetDocTypeInput>,
): Promise<AssetDocType> {
  const raw = await authFetch<unknown>(`/assets/doc-types/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return assetDocTypeSchema.parse(raw);
}

export async function deleteAssetDocType(id: string): Promise<void> {
  await authFetch<void>(`/assets/doc-types/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Condition grades
// ─────────────────────────────────────────────────────────────────────────────

export const conditionGradeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  sequence: z.number(),
  /** Both flags carry behaviour: a return at this grade sends the asset to repair
   * or condemns it (spec FR-012). The forms say so rather than leaving it implicit. */
  isDamaged: z.boolean(),
  isScrap: z.boolean(),
  active: z.boolean(),
});
export type ConditionGrade = z.infer<typeof conditionGradeSchema>;

export interface ConditionGradeInput {
  name: string;
  sequence?: number;
  isDamaged?: boolean;
  isScrap?: boolean;
  active?: boolean;
}

export async function getConditionGrades(
  companyId?: string,
): Promise<ConditionGrade[]> {
  const raw = await authFetch<unknown>(
    `/assets/condition-grades${qs({ companyId })}`,
  );
  return z.array(conditionGradeSchema).parse(raw);
}

export async function createConditionGrade(
  input: ConditionGradeInput,
  companyId?: string,
): Promise<ConditionGrade> {
  const raw = await authFetch<unknown>(
    `/assets/condition-grades${qs({ companyId })}`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return conditionGradeSchema.parse(raw);
}

export async function updateConditionGrade(
  id: string,
  input: Partial<ConditionGradeInput>,
): Promise<ConditionGrade> {
  const raw = await authFetch<unknown>(`/assets/condition-grades/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return conditionGradeSchema.parse(raw);
}

export async function deleteConditionGrade(id: string): Promise<void> {
  await authFetch<void>(`/assets/condition-grades/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// The register
// ─────────────────────────────────────────────────────────────────────────────

export const assetSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  assetCode: z.string(),
  name: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  trackingMode: openEnum(ASSET_TRACKING_MODES),
  manufacturer: z.string().nullable(),
  modelNumber: z.string().nullable(),
  serialNumber: z.string().nullable(),
  quantity: decimal,
  unitOfMeasure: z.string().nullable(),
  purchaseDate: nullableDate,
  purchaseCost: decimal,
  capitalisationDate: isoDate,
  depreciationRatePercent: decimal,
  usefulLifeYears: z.number(),
  salvageValue: decimal,
  /** Both figures come from the API and are never recomputed here (spec FR-011). */
  accumulatedDepreciation: decimal,
  bookValue: decimal,
  vendorId: z.string().nullable(),
  vendorName: z.string().nullable(),
  purchaseId: z.string().nullable(),
  currentSiteId: z.string(),
  siteName: z.string(),
  currentCustodianId: z.string().nullable(),
  custodianName: z.string().nullable(),
  currentConditionGradeId: z.string().nullable(),
  conditionGradeName: z.string().nullable(),
  status: openEnum(ASSET_STATUSES),
  nextInspectionDue: nullableDate,
  inspectionDue: z.boolean(),
  /** Answered by the list itself (spec FR-025), so nobody opens an asset to find
   * out whether its paperwork needs attention. */
  expiryAlert: z.boolean(),
  alertDocumentTypes: z.array(z.string()),
  disposalDate: nullableDate,
  createdAt: isoDate,
});
export type Asset = z.infer<typeof assetSchema>;

export const assetDocumentSchema = z.object({
  id: z.string(),
  docTypeId: z.string(),
  docTypeName: z.string(),
  fileName: z.string().nullable(),
  documentNumber: z.string().nullable(),
  issueDate: nullableDate,
  expiryDate: nullableDate,
  expiring: z.boolean(),
  expired: z.boolean(),
  uploadedAt: isoDate,
});
export type AssetDocument = z.infer<typeof assetDocumentSchema>;

export const assetStockLineSchema = z.object({
  siteId: z.string(),
  siteName: z.string(),
  onHand: decimal,
  allocated: decimal,
  inTransit: decimal,
});

export const assetDetailSchema = assetSchema.extend({
  documents: z.array(assetDocumentSchema),
  stock: z.array(assetStockLineSchema),
});
export type AssetDetail = z.infer<typeof assetDetailSchema>;

export interface AssetInput {
  assetCode?: string;
  name: string;
  categoryId: string;
  manufacturer?: string;
  modelNumber?: string;
  serialNumber?: string;
  quantity?: number;
  unitOfMeasure?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  capitalisationDate: string;
  depreciationRatePercent?: number;
  usefulLifeYears?: number;
  salvageValue?: number;
  vendorId?: string;
  purchaseId?: string;
  currentSiteId: string;
  currentConditionGradeId?: string;
  status?: string;
}

export interface AssetQuery extends PageQuery {
  search?: string;
  categoryId?: string;
  siteId?: string;
  custodianId?: string;
  status?: string;
  inspectionDue?: boolean;
}

export async function getAssets(query: AssetQuery = {}) {
  const raw = await authFetch<unknown>(`/assets${qs({ ...query })}`);
  return pageOf(assetSchema).parse(raw);
}

export async function getAsset(id: string): Promise<AssetDetail> {
  const raw = await authFetch<unknown>(`/assets/${id}`);
  return assetDetailSchema.parse(raw);
}

export async function createAsset(
  input: AssetInput,
  companyId?: string,
): Promise<Asset> {
  const raw = await authFetch<unknown>(`/assets${qs({ companyId })}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return assetSchema.parse(raw);
}

export async function updateAsset(
  id: string,
  input: Partial<AssetInput>,
): Promise<Asset> {
  const raw = await authFetch<unknown>(`/assets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return assetSchema.parse(raw);
}

export async function deleteAsset(id: string): Promise<void> {
  await authFetch<void>(`/assets/${id}`, { method: 'DELETE' });
}

export interface AssetDocumentInput {
  docTypeId: string;
  /** Base64 without the data-URL prefix — the same convention every other document
   * upload in this app uses. */
  file: string;
  fileName?: string;
  contentType?: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
}

export async function uploadAssetDocument(
  assetId: string,
  input: AssetDocumentInput,
): Promise<AssetDocument> {
  const raw = await authFetch<unknown>(`/assets/${assetId}/documents`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return assetDocumentSchema.parse(raw);
}

/** Fetched rather than linked: the endpoint needs the bearer token, which lives in
 * memory and never appears in a URL, so a plain `<a href>` would 401. */
export function getAssetDocumentFile(
  assetId: string,
  documentId: string,
): Promise<Blob> {
  return authFetchBlob(`/assets/${assetId}/documents/${documentId}/download`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock and summary
// ─────────────────────────────────────────────────────────────────────────────

export const assetStockRowSchema = z.object({
  assetId: z.string(),
  assetCode: z.string(),
  assetName: z.string(),
  categoryId: z.string(),
  siteId: z.string(),
  siteName: z.string(),
  onHand: decimal,
  allocated: decimal,
  inTransit: decimal,
  /** The registered pool at this site. Sent by the API so the three columns can be
   * shown to reconcile against it during a transfer (SC-002). */
  total: decimal,
});
export type AssetStockRow = z.infer<typeof assetStockRowSchema>;

export async function getAssetStock(
  query: { assetId?: string; siteId?: string; companyId?: string } = {},
): Promise<AssetStockRow[]> {
  const raw = await authFetch<unknown>(`/assets/stock${qs({ ...query })}`);
  return z.array(assetStockRowSchema).parse(raw);
}

const summaryBucketSchema = z.object({
  key: z.string(),
  label: z.string(),
  count: z.number(),
  purchaseCost: decimal,
  accumulatedDepreciation: decimal,
  bookValue: decimal,
});
export type SummaryBucket = z.infer<typeof summaryBucketSchema>;

export const assetSummarySchema = z.object({
  asOf: isoDate,
  totals: z.object({
    count: z.number(),
    purchaseCost: decimal,
    accumulatedDepreciation: decimal,
    bookValue: decimal,
  }),
  byCategory: z.array(summaryBucketSchema),
  byStatus: z.array(summaryBucketSchema),
  byProject: z.array(summaryBucketSchema),
});
export type AssetSummary = z.infer<typeof assetSummarySchema>;

export async function getAssetSummary(
  companyId?: string,
): Promise<AssetSummary> {
  const raw = await authFetch<unknown>(`/assets/summary${qs({ companyId })}`);
  return assetSummarySchema.parse(raw);
}

/**
 * The register as a workbook.
 *
 * Synchronous: the API builds and streams it in the request. There is no job to poll
 * — see the backend's `AssetSummaryService` for why the spec's async-above-a-threshold
 * variant is not implemented yet.
 */
export function exportAssetRegister(companyId?: string): Promise<Blob> {
  return authFetchBlob(`/assets/export${qs({ companyId })}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Allocation and custody
// ─────────────────────────────────────────────────────────────────────────────

export const allocationSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  assetId: z.string(),
  assetCode: z.string(),
  assetName: z.string(),
  projectId: z.string(),
  siteId: z.string(),
  siteName: z.string(),
  custodianEmployeeId: z.string().nullable(),
  custodianName: z.string().nullable(),
  quantity: decimal,
  allocatedFrom: isoDate,
  expectedReturnDate: isoDate,
  actualReturnDate: nullableDate,
  conditionOnReturnId: z.string().nullable(),
  conditionOnReturnName: z.string().nullable(),
  remarks: z.string().nullable(),
  status: openEnum(ASSET_ALLOCATION_STATUSES),
  overdue: z.boolean(),
  daysOverdue: z.number(),
  createdAt: isoDate,
});
export type Allocation = z.infer<typeof allocationSchema>;

export const custodyGroupSchema = z.object({
  custodianEmployeeId: z.string(),
  custodianName: z.string(),
  allocations: z.array(allocationSchema),
  overdueCount: z.number(),
});
export type CustodyGroup = z.infer<typeof custodyGroupSchema>;

export interface AllocationInput {
  assetId: string;
  projectId: string;
  siteId: string;
  custodianEmployeeId?: string;
  quantity?: number;
  allocatedFrom: string;
  expectedReturnDate: string;
  remarks?: string;
}

export interface ReturnInput {
  actualReturnDate: string;
  conditionOnReturnId: string;
  remarks?: string;
}

export interface AllocationQuery extends PageQuery {
  assetId?: string;
  projectId?: string;
  siteId?: string;
  custodianEmployeeId?: string;
  status?: string;
  overdue?: boolean;
}

export async function getAllocations(query: AllocationQuery = {}) {
  const raw = await authFetch<unknown>(`/assets/allocations${qs({ ...query })}`);
  return pageOf(allocationSchema).parse(raw);
}

export async function getOutstandingCustody(
  companyId?: string,
): Promise<CustodyGroup[]> {
  const raw = await authFetch<unknown>(
    `/assets/allocations/custody${qs({ companyId })}`,
  );
  return z.array(custodyGroupSchema).parse(raw);
}

export async function createAllocation(
  input: AllocationInput,
  companyId?: string,
): Promise<Allocation> {
  const raw = await authFetch<unknown>(
    `/assets/allocations${qs({ companyId })}`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return allocationSchema.parse(raw);
}

export async function returnAllocation(
  id: string,
  input: ReturnInput,
): Promise<Allocation> {
  const raw = await authFetch<unknown>(`/assets/allocations/${id}/return`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return allocationSchema.parse(raw);
}
