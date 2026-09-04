import { z } from 'zod';

import {
  EQUIPMENT_OWNERSHIPS,
  EQUIPMENT_STATUSES,
  HIRE_BILL_STATUSES,
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPES,
  METER_TYPES,
  POWER_SOURCES,
  SERVICE_BILL_PAYMENT_STATUSES,
  SERVICE_BILL_STATUSES,
  SERVICE_SCHEDULE_STATUSES,
  SPARE_PART_MOVEMENT_TYPES,
} from '@/app/lib/constants';
import { authFetch, authFetchBlob } from '@/app/lib/session';

/**
 * Every `/dashboard/plant/*` call to `buildcore-api` (feature 006).
 *
 * One module per domain, per Constitution Principle V — no component issues its own
 * `fetch()`. Every response is parsed through a `zod` schema before the app trusts
 * it (Principle IV), and the `z.infer` type is what the UI consumes.
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

const isoDate = z.string();

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

/** The page envelope every plant list returns. */
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
// Equipment categories (a settings master on a /plant route)
// ─────────────────────────────────────────────────────────────────────────────

export const equipmentCategorySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  meterType: z.enum(METER_TYPES),
  fuelBenchmark: nullableDecimal,
  fuelVarianceThresholdPercent: decimal,
  targetHoursPerMonth: z.number(),
  active: z.boolean(),
  equipmentCount: z.number(),
});
export type EquipmentCategory = z.infer<typeof equipmentCategorySchema>;

export interface EquipmentCategoryInput {
  name: string;
  meterType: string;
  fuelBenchmark?: number;
  fuelVarianceThresholdPercent?: number;
  targetHoursPerMonth?: number;
  active?: boolean;
}

export async function getEquipmentCategories(): Promise<EquipmentCategory[]> {
  const raw = await authFetch<unknown>('/plant/categories');
  return z.array(equipmentCategorySchema).parse(raw);
}

export async function createEquipmentCategory(
  input: EquipmentCategoryInput,
): Promise<EquipmentCategory> {
  const raw = await authFetch<unknown>('/plant/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return equipmentCategorySchema.parse(raw);
}

export async function updateEquipmentCategory(
  id: string,
  input: Partial<EquipmentCategoryInput>,
): Promise<EquipmentCategory> {
  const raw = await authFetch<unknown>(`/plant/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return equipmentCategorySchema.parse(raw);
}

export async function deleteEquipmentCategory(id: string): Promise<void> {
  await authFetch<void>(`/plant/categories/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Equipment document types
// ─────────────────────────────────────────────────────────────────────────────

export const equipmentDocTypeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  alertDays: z.number(),
  active: z.boolean(),
});
export type EquipmentDocType = z.infer<typeof equipmentDocTypeSchema>;

export interface EquipmentDocTypeInput {
  name: string;
  alertDays?: number;
  active?: boolean;
}

export async function getEquipmentDocTypes(): Promise<EquipmentDocType[]> {
  const raw = await authFetch<unknown>('/plant/doc-types');
  return z.array(equipmentDocTypeSchema).parse(raw);
}

export async function createEquipmentDocType(
  input: EquipmentDocTypeInput,
): Promise<EquipmentDocType> {
  const raw = await authFetch<unknown>('/plant/doc-types', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return equipmentDocTypeSchema.parse(raw);
}

export async function updateEquipmentDocType(
  id: string,
  input: Partial<EquipmentDocTypeInput>,
): Promise<EquipmentDocType> {
  const raw = await authFetch<unknown>(`/plant/doc-types/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return equipmentDocTypeSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hire rates
// ─────────────────────────────────────────────────────────────────────────────

export const hireRateSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  ratePerUnit: decimal,
  effectiveFrom: isoDate,
  /** Null is the open end of the timeline — rendered as "Current". */
  effectiveTo: isoDate.nullable(),
});
export type HireRate = z.infer<typeof hireRateSchema>;

export interface HireRateInput {
  categoryId: string;
  ratePerUnit: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export async function getHireRates(categoryId?: string): Promise<HireRate[]> {
  const raw = await authFetch<unknown>(`/plant/rates${qs({ categoryId })}`);
  return z.array(hireRateSchema).parse(raw);
}

export async function createHireRate(input: HireRateInput): Promise<HireRate> {
  const raw = await authFetch<unknown>('/plant/rates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return hireRateSchema.parse(raw);
}

export async function deleteHireRate(id: string): Promise<void> {
  await authFetch<void>(`/plant/rates/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Equipment
// ─────────────────────────────────────────────────────────────────────────────

export const equipmentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  ownership: z.enum(EQUIPMENT_OWNERSHIPS),
  vendorId: z.string().nullable(),
  vendorName: z.string().nullable(),
  powerSource: z.enum(POWER_SOURCES),
  meterType: z.enum(METER_TYPES),
  currentReading: decimal,
  deployedSiteId: z.string().nullable(),
  siteName: z.string().nullable(),
  status: z.enum(EQUIPMENT_STATUSES),
  utilizationPercent: decimal,
  purchaseDate: isoDate.nullable(),
  purchaseCost: nullableDecimal,
  depreciationRate: nullableDecimal,
  /** SC-001: the register answers "is any paperwork about to lapse?" in the list
   * response itself, with no second call. */
  expiryAlert: z.boolean(),
  alertDocumentTypes: z.array(z.string()),
});
export type Equipment = z.infer<typeof equipmentSchema>;

export const equipmentDocumentSchema = z.object({
  id: z.string(),
  docTypeId: z.string(),
  docTypeName: z.string(),
  fileName: z.string().nullable(),
  expiresAt: isoDate.nullable(),
  expiring: z.boolean(),
  expired: z.boolean(),
  uploadedAt: isoDate,
});
export type EquipmentDocument = z.infer<typeof equipmentDocumentSchema>;

export const equipmentDetailSchema = equipmentSchema.extend({
  documents: z.array(equipmentDocumentSchema),
  serviceSchedules: z.array(
    z.object({
      id: z.string(),
      serviceType: z.string(),
      intervalHours: nullableDecimal,
      intervalKm: nullableDecimal,
      lastDoneReading: decimal,
      nextDueReading: decimal,
      status: z.enum(SERVICE_SCHEDULE_STATUSES),
    }),
  ),
  openMaintenanceJobId: z.string().nullable(),
});
export type EquipmentDetail = z.infer<typeof equipmentDetailSchema>;

export const equipmentPageSchema = pageOf(equipmentSchema);
export type EquipmentPage = z.infer<typeof equipmentPageSchema>;

export interface EquipmentQuery extends PageQuery {
  search?: string;
  categoryId?: string;
  siteId?: string;
  status?: string;
  ownership?: string;
}

export async function getEquipment(
  query: EquipmentQuery = {},
): Promise<EquipmentPage> {
  const raw = await authFetch<unknown>(`/plant/equipment${qs({ ...query })}`);
  return equipmentPageSchema.parse(raw);
}

export async function getEquipmentDetail(
  id: string,
): Promise<EquipmentDetail> {
  const raw = await authFetch<unknown>(`/plant/equipment/${id}`);
  return equipmentDetailSchema.parse(raw);
}

export interface EquipmentInput {
  code?: string;
  name: string;
  categoryId: string;
  ownership: string;
  vendorId?: string;
  powerSource: string;
  purchaseDate?: string;
  purchaseCost?: number;
  depreciationRate?: number;
  deployedSiteId?: string;
  currentReading?: number;
  status?: string;
}

export async function createEquipment(
  input: EquipmentInput,
): Promise<Equipment> {
  const raw = await authFetch<unknown>('/plant/equipment', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return equipmentSchema.parse(raw);
}

export async function updateEquipment(
  id: string,
  input: Partial<EquipmentInput>,
): Promise<Equipment> {
  const raw = await authFetch<unknown>(`/plant/equipment/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return equipmentSchema.parse(raw);
}

export const maintenanceCostSchema = z.object({
  equipmentId: z.string(),
  partsCost: decimal,
  labourCost: decimal,
  serviceBillCost: decimal,
  totalCost: decimal,
  jobCount: z.number(),
});
export type MaintenanceCost = z.infer<typeof maintenanceCostSchema>;

export async function getEquipmentMaintenanceCost(
  id: string,
): Promise<MaintenanceCost> {
  const raw = await authFetch<unknown>(
    `/plant/equipment/${id}/maintenance-cost`,
  );
  return maintenanceCostSchema.parse(raw);
}

export interface EquipmentDocumentInput {
  docTypeId: string;
  /** Base64, matching every other document upload in this app. */
  file: string;
  fileName?: string;
  contentType?: string;
  expiresAt?: string;
}

export async function uploadEquipmentDocument(
  equipmentId: string,
  input: EquipmentDocumentInput,
): Promise<EquipmentDocument> {
  const raw = await authFetch<unknown>(
    `/plant/equipment/${equipmentId}/documents`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return equipmentDocumentSchema.parse(raw);
}

export async function getEquipmentDocumentFile(
  equipmentId: string,
  documentId: string,
): Promise<Blob> {
  return authFetchBlob(
    `/plant/equipment/${equipmentId}/documents/${documentId}/download`,
  );
}

export async function deleteEquipmentDocument(
  equipmentId: string,
  documentId: string,
): Promise<void> {
  await authFetch<void>(
    `/plant/equipment/${equipmentId}/documents/${documentId}`,
    { method: 'DELETE' },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Logbook
// ─────────────────────────────────────────────────────────────────────────────

export const logbookEntrySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  equipmentId: z.string(),
  equipmentCode: z.string(),
  equipmentName: z.string(),
  date: isoDate,
  openingReading: decimal,
  closingReading: decimal,
  totalHours: decimal,
  fuelConsumed: nullableDecimal,
  operatorId: z.string().nullable(),
  operatorName: z.string().nullable(),
  projectId: z.string().nullable(),
  remarks: z.string().nullable(),
});
export type LogbookEntry = z.infer<typeof logbookEntrySchema>;

export const logbookPageSchema = pageOf(logbookEntrySchema);
export type LogbookPage = z.infer<typeof logbookPageSchema>;

export interface LogbookQuery extends PageQuery {
  equipmentId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getLogbook(
  query: LogbookQuery = {},
): Promise<LogbookPage> {
  const raw = await authFetch<unknown>(`/plant/logbook${qs({ ...query })}`);
  return logbookPageSchema.parse(raw);
}

export interface LogbookInput {
  equipmentId: string;
  date: string;
  openingReading: number;
  closingReading: number;
  fuelConsumed?: number;
  operatorId?: string;
  projectId?: string;
  remarks?: string;
}

export async function createLogbookEntry(
  input: LogbookInput,
): Promise<LogbookEntry> {
  const raw = await authFetch<unknown>('/plant/logbook', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return logbookEntrySchema.parse(raw);
}

export async function deleteLogbookEntry(id: string): Promise<void> {
  await authFetch<void>(`/plant/logbook/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Fuel
// ─────────────────────────────────────────────────────────────────────────────

export const fuelEntrySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  equipmentId: z.string(),
  equipmentCode: z.string(),
  equipmentName: z.string(),
  date: isoDate,
  quantity: decimal,
  rate: decimal,
  amount: decimal,
  vendorId: z.string().nullable(),
  vendorName: z.string().nullable(),
  variancePercent: nullableDecimal,
  varianceAlert: z.boolean(),
});
export type FuelEntry = z.infer<typeof fuelEntrySchema>;

export const fuelPageSchema = pageOf(fuelEntrySchema);
export type FuelPage = z.infer<typeof fuelPageSchema>;

export interface FuelQuery extends PageQuery {
  equipmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  varianceOnly?: string;
}

export async function getFuelEntries(
  query: FuelQuery = {},
): Promise<FuelPage> {
  const raw = await authFetch<unknown>(`/plant/fuel${qs({ ...query })}`);
  return fuelPageSchema.parse(raw);
}

export interface FuelInput {
  equipmentId: string;
  date: string;
  quantity: number;
  rate: number;
  vendorId?: string;
}

export async function createFuelEntry(input: FuelInput): Promise<FuelEntry> {
  const raw = await authFetch<unknown>('/plant/fuel', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return fuelEntrySchema.parse(raw);
}

export const fuelSummarySchema = z.object({
  month: z.string(),
  items: z.array(
    z.object({
      equipmentId: z.string(),
      equipmentCode: z.string(),
      equipmentName: z.string(),
      totalQuantity: decimal,
      totalAmount: decimal,
      entryCount: z.number(),
      alertCount: z.number(),
    }),
  ),
  totalQuantity: decimal,
  totalAmount: decimal,
});
export type FuelSummary = z.infer<typeof fuelSummarySchema>;

export async function getFuelSummary(month: string): Promise<FuelSummary> {
  const raw = await authFetch<unknown>(`/plant/fuel/summary${qs({ month })}`);
  return fuelSummarySchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Service schedules
// ─────────────────────────────────────────────────────────────────────────────

export const serviceScheduleSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  equipmentId: z.string(),
  equipmentCode: z.string(),
  equipmentName: z.string(),
  serviceType: z.string(),
  intervalHours: nullableDecimal,
  intervalKm: nullableDecimal,
  lastDoneReading: decimal,
  nextDueReading: decimal,
  currentReading: decimal,
  status: z.enum(SERVICE_SCHEDULE_STATUSES),
  /** Negative when overdue. Meter units, not days. */
  readingsRemaining: decimal,
});
export type ServiceSchedule = z.infer<typeof serviceScheduleSchema>;

export const serviceSchedulePageSchema = pageOf(serviceScheduleSchema);
export type ServiceSchedulePage = z.infer<typeof serviceSchedulePageSchema>;

export interface ServiceScheduleQuery extends PageQuery {
  equipmentId?: string;
  status?: string;
}

export async function getServiceSchedules(
  query: ServiceScheduleQuery = {},
): Promise<ServiceSchedulePage> {
  const raw = await authFetch<unknown>(`/plant/services${qs({ ...query })}`);
  return serviceSchedulePageSchema.parse(raw);
}

export interface ServiceScheduleInput {
  equipmentId: string;
  serviceType: string;
  intervalHours?: number;
  intervalKm?: number;
  lastDoneReading: number;
}

export async function createServiceSchedule(
  input: ServiceScheduleInput,
): Promise<ServiceSchedule> {
  const raw = await authFetch<unknown>('/plant/services', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return serviceScheduleSchema.parse(raw);
}

export async function updateServiceSchedule(
  id: string,
  input: Partial<ServiceScheduleInput>,
): Promise<ServiceSchedule> {
  const raw = await authFetch<unknown>(`/plant/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return serviceScheduleSchema.parse(raw);
}

export async function deleteServiceSchedule(id: string): Promise<void> {
  await authFetch<void>(`/plant/services/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Maintenance jobs
// ─────────────────────────────────────────────────────────────────────────────

export const maintenanceJobSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  equipmentId: z.string(),
  equipmentCode: z.string(),
  equipmentName: z.string(),
  type: z.enum(MAINTENANCE_TYPES),
  description: z.string(),
  openedAt: isoDate,
  closedAt: isoDate.nullable(),
  closingReading: nullableDecimal,
  partsDescription: z.string().nullable(),
  labourCost: nullableDecimal,
  /** Accrued from part consumption, never client-supplied. */
  partsCost: decimal,
  serviceBillCost: decimal,
  totalCost: decimal,
  linkedServiceScheduleId: z.string().nullable(),
  status: z.enum(MAINTENANCE_STATUSES),
});
export type MaintenanceJob = z.infer<typeof maintenanceJobSchema>;

export const maintenanceJobPageSchema = pageOf(maintenanceJobSchema);
export type MaintenanceJobPage = z.infer<typeof maintenanceJobPageSchema>;

export interface MaintenanceQuery extends PageQuery {
  equipmentId?: string;
  status?: string;
  type?: string;
}

export async function getMaintenanceJobs(
  query: MaintenanceQuery = {},
): Promise<MaintenanceJobPage> {
  const raw = await authFetch<unknown>(`/plant/maintenance${qs({ ...query })}`);
  return maintenanceJobPageSchema.parse(raw);
}

export async function getMaintenanceJob(id: string): Promise<MaintenanceJob> {
  const raw = await authFetch<unknown>(`/plant/maintenance/${id}`);
  return maintenanceJobSchema.parse(raw);
}

export interface MaintenanceJobInput {
  equipmentId: string;
  type: string;
  description: string;
  linkedServiceScheduleId?: string;
}

export async function createMaintenanceJob(
  input: MaintenanceJobInput,
): Promise<MaintenanceJob> {
  const raw = await authFetch<unknown>('/plant/maintenance', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return maintenanceJobSchema.parse(raw);
}

export interface CloseMaintenanceJobInput {
  closingReading: number;
  closedAt?: string;
  partsDescription?: string;
  labourCost?: number;
}

export async function closeMaintenanceJob(
  id: string,
  input: CloseMaintenanceJobInput,
): Promise<MaintenanceJob> {
  const raw = await authFetch<unknown>(`/plant/maintenance/${id}/close`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return maintenanceJobSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hire bills
// ─────────────────────────────────────────────────────────────────────────────

export const hireBillSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  equipmentId: z.string(),
  equipmentCode: z.string(),
  equipmentName: z.string(),
  vendorId: z.string(),
  vendorName: z.string(),
  billedHours: decimal,
  rate: decimal,
  grossAmount: decimal,
  billingPeriodFrom: isoDate,
  billingPeriodTo: isoDate,
  /** What the logbook said when the bill was raised — a snapshot, not a live join. */
  logbookHours: decimal,
  variance: decimal,
  tdsRate: nullableDecimal,
  tdsAmount: decimal,
  netPayable: decimal,
  status: z.enum(HIRE_BILL_STATUSES),
  verifiedAt: isoDate.nullable(),
  paymentDate: isoDate.nullable(),
  paymentReference: z.string().nullable(),
});
export type HireBill = z.infer<typeof hireBillSchema>;

export const hireBillPageSchema = pageOf(hireBillSchema).extend({
  pendingVerificationCount: z.number(),
  unpaidTotal: decimal,
});
export type HireBillPage = z.infer<typeof hireBillPageSchema>;

export interface HireBillQuery extends PageQuery {
  equipmentId?: string;
  vendorId?: string;
  status?: string;
}

export async function getHireBills(
  query: HireBillQuery = {},
): Promise<HireBillPage> {
  const raw = await authFetch<unknown>(`/plant/hire-bills${qs({ ...query })}`);
  return hireBillPageSchema.parse(raw);
}

export interface HireBillInput {
  equipmentId: string;
  vendorId: string;
  billedHours: number;
  /** Omitted to take the effective hire rate for the period's start (FR-014). */
  rate?: number;
  billingPeriodFrom: string;
  billingPeriodTo: string;
}

export async function createHireBill(input: HireBillInput): Promise<HireBill> {
  const raw = await authFetch<unknown>('/plant/hire-bills', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return hireBillSchema.parse(raw);
}

export async function verifyHireBill(id: string): Promise<HireBill> {
  const raw = await authFetch<unknown>(`/plant/hire-bills/${id}/verify`, {
    method: 'PATCH',
  });
  return hireBillSchema.parse(raw);
}

export async function payHireBill(
  id: string,
  input: { paymentDate: string; paymentReference: string },
): Promise<HireBill> {
  const raw = await authFetch<unknown>(`/plant/hire-bills/${id}/pay`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return hireBillSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Spare parts
// ─────────────────────────────────────────────────────────────────────────────

export const sparePartSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  partNumber: z.string(),
  name: z.string(),
  unitOfMeasure: z.string(),
  reorderLevel: nullableDecimal,
  compatibleCategoryIds: z.array(z.string()),
  compatibleCategoryNames: z.array(z.string()),
  linkedInventoryItemId: z.string().nullable(),
  stockQuantity: decimal,
  avgRate: decimal,
  stockValue: decimal,
  belowReorderLevel: z.boolean(),
  active: z.boolean(),
});
export type SparePart = z.infer<typeof sparePartSchema>;

export const sparePartPageSchema = pageOf(sparePartSchema).extend({
  belowReorderCount: z.number(),
});
export type SparePartPage = z.infer<typeof sparePartPageSchema>;

export interface SparePartQuery extends PageQuery {
  search?: string;
  categoryId?: string;
  belowReorder?: string;
}

export async function getSpareParts(
  query: SparePartQuery = {},
): Promise<SparePartPage> {
  const raw = await authFetch<unknown>(`/plant/spare-parts${qs({ ...query })}`);
  return sparePartPageSchema.parse(raw);
}

export interface SparePartInput {
  partNumber: string;
  name: string;
  unitOfMeasure: string;
  reorderLevel?: number;
  compatibleCategoryIds?: string[];
  linkedInventoryItemId?: string;
  active?: boolean;
}

export async function createSparePart(
  input: SparePartInput,
): Promise<SparePart> {
  const raw = await authFetch<unknown>('/plant/spare-parts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return sparePartSchema.parse(raw);
}

export async function updateSparePart(
  id: string,
  input: Partial<SparePartInput>,
): Promise<SparePart> {
  const raw = await authFetch<unknown>(`/plant/spare-parts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return sparePartSchema.parse(raw);
}

export async function deleteSparePart(id: string): Promise<void> {
  await authFetch<void>(`/plant/spare-parts/${id}`, { method: 'DELETE' });
}

export async function receiveSparePart(
  id: string,
  input: {
    quantity: number;
    rate: number;
    receiptDate: string;
    vendorId?: string;
    billReference?: string;
  },
): Promise<SparePart> {
  const raw = await authFetch<unknown>(`/plant/spare-parts/${id}/receipts`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return sparePartSchema.parse(raw);
}

export const sparePartMovementSchema = z.object({
  id: z.string(),
  sparePartId: z.string(),
  partNumber: z.string(),
  partName: z.string(),
  type: z.enum(SPARE_PART_MOVEMENT_TYPES),
  quantity: decimal,
  /** The rate in force when the movement happened — never restated. */
  rate: decimal,
  amount: decimal,
  movementDate: isoDate,
  maintenanceJobId: z.string().nullable(),
  vendorId: z.string().nullable(),
  billReference: z.string().nullable(),
  incompatiblePart: z.boolean(),
  reversalOfId: z.string().nullable(),
  reversed: z.boolean(),
  reason: z.string().nullable(),
});
export type SparePartMovement = z.infer<typeof sparePartMovementSchema>;

export async function getSparePartMovements(
  sparePartId: string,
): Promise<SparePartMovement[]> {
  const raw = await authFetch<unknown>(
    `/plant/spare-parts/${sparePartId}/movements`,
  );
  return z.array(sparePartMovementSchema).parse(raw);
}

export async function getJobParts(
  jobId: string,
): Promise<SparePartMovement[]> {
  const raw = await authFetch<unknown>(`/plant/maintenance/${jobId}/parts`);
  return z.array(sparePartMovementSchema).parse(raw);
}

export async function consumeSparePart(
  jobId: string,
  input: { sparePartId: string; quantity: number; consumedOn?: string },
): Promise<SparePartMovement> {
  const raw = await authFetch<unknown>(`/plant/maintenance/${jobId}/parts`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return sparePartMovementSchema.parse(raw);
}

export async function reversePartConsumption(
  movementId: string,
  reason: string,
): Promise<SparePartMovement> {
  const raw = await authFetch<unknown>(
    `/plant/maintenance/parts/${movementId}`,
    { method: 'DELETE', body: JSON.stringify({ reason }) },
  );
  return sparePartMovementSchema.parse(raw);
}

export const reconciliationSchema = z.object({
  items: z.array(
    z.object({
      sparePartId: z.string(),
      partNumber: z.string(),
      partName: z.string(),
      plantStock: decimal,
      plantAvgRate: decimal,
      linkedInventoryItemId: z.string(),
      inventoryItemName: z.string().nullable(),
      inventoryStock: nullableDecimal,
      inventoryAvgRate: nullableDecimal,
      difference: nullableDecimal,
    }),
  ),
});
export type Reconciliation = z.infer<typeof reconciliationSchema>;

export async function getSparePartReconciliation(): Promise<Reconciliation> {
  const raw = await authFetch<unknown>('/plant/spare-parts/reconciliation');
  return reconciliationSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Service bills
// ─────────────────────────────────────────────────────────────────────────────

export const serviceBillSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  maintenanceJobId: z.string(),
  equipmentId: z.string(),
  equipmentCode: z.string(),
  equipmentName: z.string(),
  vendorId: z.string(),
  vendorName: z.string(),
  billNumber: z.string(),
  billDate: isoDate,
  grossAmount: decimal,
  taxAmount: decimal,
  tdsPercent: decimal,
  tdsAmount: decimal,
  netPayable: decimal,
  status: z.enum(SERVICE_BILL_STATUSES),
  verifiedAt: isoDate.nullable(),
  paymentStatus: z.enum(SERVICE_BILL_PAYMENT_STATUSES),
  paidAmount: decimal,
  paidOn: isoDate.nullable(),
  paymentReference: z.string().nullable(),
});
export type ServiceBill = z.infer<typeof serviceBillSchema>;

export const serviceBillPageSchema = pageOf(serviceBillSchema).extend({
  pendingPaymentTotal: decimal,
});
export type ServiceBillPage = z.infer<typeof serviceBillPageSchema>;

export interface ServiceBillQuery extends PageQuery {
  vendorId?: string;
  equipmentId?: string;
  maintenanceJobId?: string;
  status?: string;
  paymentStatus?: string;
  from?: string;
  to?: string;
}

export async function getServiceBills(
  query: ServiceBillQuery = {},
): Promise<ServiceBillPage> {
  const raw = await authFetch<unknown>(
    `/plant/service-bills${qs({ ...query })}`,
  );
  return serviceBillPageSchema.parse(raw);
}

export interface ServiceBillInput {
  maintenanceJobId: string;
  vendorId: string;
  billNumber: string;
  billDate: string;
  grossAmount: number;
  taxAmount?: number;
  /** Omitted to take the vendor's own TDS rate from Partners. */
  tdsPercent?: number;
}

export async function createServiceBill(
  input: ServiceBillInput,
): Promise<ServiceBill> {
  const raw = await authFetch<unknown>('/plant/service-bills', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return serviceBillSchema.parse(raw);
}

export async function verifyServiceBill(id: string): Promise<ServiceBill> {
  const raw = await authFetch<unknown>(`/plant/service-bills/${id}/verify`, {
    method: 'PATCH',
  });
  return serviceBillSchema.parse(raw);
}

export async function payServiceBill(
  id: string,
  input: { paidOn: string; paidAmount: number; paymentReference: string },
): Promise<ServiceBill> {
  const raw = await authFetch<unknown>(`/plant/service-bills/${id}/pay`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return serviceBillSchema.parse(raw);
}

export async function deleteServiceBill(id: string): Promise<void> {
  await authFetch<void>(`/plant/service-bills/${id}`, { method: 'DELETE' });
}
