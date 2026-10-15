import { z } from 'zod';

import {
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
import type { StoredFile } from '@/app/lib/api/client';
import { authFetch, authFetchFile } from '@/app/lib/session';

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
  /** The family a category sits under in the client's master list — "Vehicle Fleet",
   * "Road Construction & Highway Machinery" (2026-10-15). Null for one made by hand. */
  group: z.string().nullable(),
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
  /** Blank clears it on an update. */
  group?: string;
  meterType: string;
  fuelBenchmark?: number;
  fuelVarianceThresholdPercent?: number;
  targetHoursPerMonth?: number;
  active?: boolean;
}

export async function getEquipmentCategories(
  companyId?: string,
): Promise<EquipmentCategory[]> {
  const raw = await authFetch<unknown>(`/plant/categories${qs({ companyId })}`);
  return z.array(equipmentCategorySchema).parse(raw);
}

export async function createEquipmentCategory(
  input: EquipmentCategoryInput,
  companyId?: string,
): Promise<EquipmentCategory> {
  const raw = await authFetch<unknown>(
    `/plant/categories${qs({ companyId })}`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
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

export async function getEquipmentDocTypes(
  companyId?: string,
): Promise<EquipmentDocType[]> {
  const raw = await authFetch<unknown>(`/plant/doc-types${qs({ companyId })}`);
  return z.array(equipmentDocTypeSchema).parse(raw);
}

export async function createEquipmentDocType(
  input: EquipmentDocTypeInput,
  companyId?: string,
): Promise<EquipmentDocType> {
  const raw = await authFetch<unknown>(`/plant/doc-types${qs({ companyId })}`, {
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

export async function getHireRates(
  categoryId?: string,
  companyId?: string,
): Promise<HireRate[]> {
  const raw = await authFetch<unknown>(
    `/plant/rates${qs({ categoryId, companyId })}`,
  );
  return z.array(hireRateSchema).parse(raw);
}

export async function createHireRate(
  input: HireRateInput,
  companyId?: string,
): Promise<HireRate> {
  const raw = await authFetch<unknown>(`/plant/rates${qs({ companyId })}`, {
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

/**
 * How a machine is held (2026-10-15). `leased` joins owned and hired with the client's master
 * list, which has all three; a hired machine needs its vendor, a leased one may name one.
 */
export const PLANT_OWNERSHIPS = ['owned', 'hired', 'leased'] as const;
export type PlantOwnership = (typeof PLANT_OWNERSHIPS)[number];

/** The six papers of the client's vehicle register, in its column order (2026-10-15). */
export const REGISTRATION_KINDS = [
  'rc',
  'insurance',
  'fitness',
  'road_tax',
  'permit',
  'pollution',
] as const;
export type RegistrationKind = (typeof REGISTRATION_KINDS)[number];

export const REGISTRATION_KIND_LABELS: Record<RegistrationKind, string> = {
  rc: 'RC',
  insurance: 'Insurance',
  fitness: 'Fitness',
  road_tax: 'Road Tax',
  permit: 'Permit',
  pollution: 'Pollution',
};

/** `lifetime` is the register's "Life time" — a road tax paid once for the vehicle's life. */
export const REGISTRATION_STATUSES = [
  'held',
  'not_applicable',
  'lifetime',
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  held: 'Held',
  not_applicable: 'N/A',
  lifetime: 'Life time',
};

export const registrationPaperSchema = z.object({
  kind: z.enum(REGISTRATION_KINDS),
  status: z.enum(REGISTRATION_STATUSES),
  expiresAt: isoDate.nullable(),
  number: z.string().nullable(),
  hasDocument: z.boolean(),
});
export type RegistrationPaper = z.infer<typeof registrationPaperSchema>;

export const equipmentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  // The registration form's details (2026-10-15) — every one may be blank on an older machine.
  manufacturingYear: z.number().nullable(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  registrationNo: z.string().nullable(),
  engineNo: z.string().nullable(),
  chassisNo: z.string().nullable(),
  supplierName: z.string().nullable(),
  /** The register's "Firm" — whose name the RC stands in. */
  registeredOwner: z.string().nullable(),
  operatorName: z.string().nullable(),
  remarks: z.string().nullable(),
  lastServiceDate: isoDate.nullable(),
  /** A paper never recorded and with no document uploaded is absent, not a row of nulls. */
  registration: z.array(registrationPaperSchema),
  categoryId: z.string(),
  categoryName: z.string(),
  ownership: z.enum(PLANT_OWNERSHIPS),
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

export async function getEquipmentDetail(id: string): Promise<EquipmentDetail> {
  const raw = await authFetch<unknown>(`/plant/equipment/${id}`);
  return equipmentDetailSchema.parse(raw);
}

export interface RegistrationPaperInput {
  kind: RegistrationKind;
  status: RegistrationStatus;
  /** YYYY-MM-DD; only meaningful when held. */
  expiresAt?: string;
  number?: string;
}

export interface EquipmentInput {
  name: string;
  /** The year it was built — the last part of its code (`JCB01/2027`). */
  manufacturingYear?: number;
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
  make?: string;
  model?: string;
  registrationNo?: string;
  engineNo?: string;
  chassisNo?: string;
  supplierName?: string;
  registeredOwner?: string;
  operatorName?: string;
  remarks?: string;
  lastServiceDate?: string;
  /** Each kind given replaces that paper; kinds left out are kept as they are. */
  registration?: RegistrationPaperInput[];
  /** Create only: a periodic service every N hours, or N km on a km-metered category. */
  serviceInterval?: number;
}

/**
 * The code a machine with this name and year would be given (2026-10-15) — a preview for the
 * registration form; the code is built again when the machine is saved.
 */
export async function getNextEquipmentCode(
  name: string,
  year?: number,
): Promise<string> {
  const raw = await authFetch<{ code: string }>(
    `/plant/equipment/next-code${qs({ name, ...(year ? { year: String(year) } : {}) })}`,
  );
  return raw.code;
}

export async function createEquipment(
  input: EquipmentInput,
  companyId?: string,
): Promise<Equipment> {
  const raw = await authFetch<unknown>(`/plant/equipment${qs({ companyId })}`, {
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

export interface EquipmentRegisterFilters {
  companyId?: string;
  categoryId?: string;
  siteId?: string;
  status?: string;
  ownership?: string;
}

/**
 * The client's "M/S <company> - VEHICLE DETAILS (As on …)" sheet for the machines the register
 * is filtered to (2026-10-15).
 */
export async function downloadEquipmentRegister(
  format: 'pdf' | 'xlsx',
  filters: EquipmentRegisterFilters,
): Promise<{ blob: Blob; filename: string }> {
  const { blob, filename } = await authFetchFile(
    `/plant/equipment/register.${format}${qs({ ...filters })}`,
  );
  return { blob, filename: filename ?? `Vehicle details.${format}` };
}

export const equipmentImportResultSchema = z.object({
  categoriesCreated: z.number(),
  categoriesExisting: z.number(),
  equipmentCreated: z.number(),
  skipped: z.array(
    z.object({ row: z.number(), name: z.string(), reason: z.string() }),
  ),
});
export type EquipmentImportResult = z.infer<typeof equipmentImportResultSchema>;

/** The one-time Equipment Master List import (2026-10-15); `file` is base64 without a prefix. */
export async function importEquipmentMasterList(
  file: string,
  fileName: string,
  companyId?: string,
): Promise<EquipmentImportResult> {
  const raw = await authFetch<unknown>(
    `/plant/equipment/import${qs({ companyId })}`,
    { method: 'POST', body: JSON.stringify({ file, fileName }) },
  );
  return equipmentImportResultSchema.parse(raw);
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
): Promise<StoredFile> {
  return authFetchFile(
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

/**
 * The client's "Vehicle Log Book and Diesel Report Sheet" (2026-10-15): one machine, one month,
 * every day of it — the readings are logbook entries, the diesel is fuel entries.
 */
export const logbookSheetSchema = z.object({
  equipment: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    registrationNo: z.string().nullable(),
    meterType: z.enum(METER_TYPES),
  }),
  month: z.string(),
  days: z.array(
    z.object({
      date: z.string(),
      logbookEntryId: z.string().nullable(),
      openingReading: nullableDecimal,
      closingReading: nullableDecimal,
      total: nullableDecimal,
      cardNo: z.string().nullable(),
      dieselAmount: nullableDecimal,
      dieselQuantity: nullableDecimal,
    }),
  ),
  /** The last closing reading before the month — where its first day starts. */
  carriedReading: nullableDecimal,
  totals: z.object({
    dieselAmount: decimal,
    dieselQuantity: decimal,
    total: decimal,
  }),
  average: nullableDecimal,
  averageUnit: z.string(),
});
export type LogbookSheet = z.infer<typeof logbookSheetSchema>;
export type LogbookSheetDay = LogbookSheet['days'][number];

export async function getLogbookSheet(
  equipmentId: string,
  month: string,
): Promise<LogbookSheet> {
  const raw = await authFetch<unknown>(
    `/plant/logbook/sheet${qs({ equipmentId, month })}`,
  );
  return logbookSheetSchema.parse(raw);
}

export interface LogbookSheetRowInput {
  date: string;
  openingReading?: number;
  closingReading?: number;
  cardNo?: string;
  dieselAmount?: number;
  dieselQuantity?: number;
}

/** Saves the days entered and returns the refreshed sheet; a day already read is a 409. */
export async function saveLogbookSheet(input: {
  equipmentId: string;
  month: string;
  rows: LogbookSheetRowInput[];
}): Promise<LogbookSheet> {
  const raw = await authFetch<unknown>('/plant/logbook/sheet', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return logbookSheetSchema.parse(raw);
}

export async function downloadLogbookSheet(
  equipmentId: string,
  month: string,
  format: 'pdf' | 'xlsx',
): Promise<{ blob: Blob; filename: string }> {
  const { blob, filename } = await authFetchFile(
    `/plant/logbook/sheet.${format}${qs({ equipmentId, month })}`,
  );
  return { blob, filename: filename ?? `Log book ${month}.${format}` };
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
  /** Null on an entry recorded before the column existed — see `FuelEntry.siteId`. */
  siteId: z.string().nullable(),
  siteName: z.string().nullable(),
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

export async function getFuelEntries(query: FuelQuery = {}): Promise<FuelPage> {
  const raw = await authFetch<unknown>(`/plant/fuel${qs({ ...query })}`);
  return fuelPageSchema.parse(raw);
}

export interface FuelInput {
  equipmentId: string;
  date: string;
  quantity: number;
  /** One of `rate` or `amount` (2026-10-15): the amount paid derives the rate on the server. */
  rate?: number;
  amount?: number;
  /** The fuel card it was drawn on. */
  cardNo?: string;
  vendorId?: string;
  /** Omitted, the API takes it from where the machine is deployed, and stores it. */
  siteId?: string;
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

export async function getFuelSummary(
  month: string,
  companyId?: string,
): Promise<FuelSummary> {
  const raw = await authFetch<unknown>(
    `/plant/fuel/summary${qs({ month, companyId })}`,
  );
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
  /** The job card's number once a card is saved (2026-10-15). */
  jobCardNo: z.string().nullable().optional(),
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
  companyId?: string,
): Promise<SparePart> {
  const raw = await authFetch<unknown>(
    `/plant/spare-parts${qs({ companyId })}`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
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

export async function getJobParts(jobId: string): Promise<SparePartMovement[]> {
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

// ─────────────────────────────────────────────────────────────────────────────
// Fuel exceptions and recovery (020 FR-001 – FR-006 — `bugs.md` item 13)
// ─────────────────────────────────────────────────────────────────────────────

export const FUEL_EXCEPTION_STATUSES = [
  'open',
  'confirmed',
  'dismissed',
] as const;
export type FuelExceptionStatus = (typeof FUEL_EXCEPTION_STATUSES)[number];

/** Who bears a confirmed loss. `neither` is a real answer, not an absence of one. */
export const FUEL_ATTRIBUTIONS = [
  'hirer',
  'operator',
  'both',
  'neither',
] as const;
export type FuelAttribution = (typeof FUEL_ATTRIBUTIONS)[number];

export const fuelExceptionSchema = z.object({
  id: z.string(),
  status: z.enum(FUEL_EXCEPTION_STATUSES),
  attribution: z.enum(FUEL_ATTRIBUTIONS).nullable(),
  operatorEmployeeId: z.string().nullable(),
  reason: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: isoDate,

  fuelEntry: z.object({
    id: z.string(),
    equipmentId: z.string(),
    date: isoDate,
    quantity: decimal,
    rate: decimal,
    amount: decimal,
    /** Computed and rounded at save time. Shown, never used to derive money — see `shortfallAmount`. */
    variancePercent: nullableDecimal,
    equipment: z.object({
      id: z.string(),
      code: z.string(),
      name: z.string(),
      ownership: z.enum(PLANT_OWNERSHIPS),
      categoryId: z.string(),
    }),
  }),

  /** Litres per meter unit the category expects. Null where nobody has set one. */
  benchmark: nullableDecimal,
  /**
   * What was actually burned per meter unit.
   *
   * **Null is not zero.** Null means the logbook has no reading for that day — the fuel was issued
   * and nobody entered the machine's hours — and rendering it as zero would read as a machine that
   * ran no hours and still burned fuel, which is an accusation rather than a gap.
   */
  actualPerHour: nullableDecimal,
  /** The excess over what the benchmark allowed for the hours actually run (FR-001). */
  shortfallQuantity: decimal,
  /** That excess at the entry's own fuel rate, not today's. */
  shortfallAmount: decimal,

  /** Present once recovered. Both absent is the ordinary state for a confirmed exception. */
  hireBillDeduction: z
    .object({ id: z.string(), amount: decimal })
    .nullable()
    .optional(),
  operatorRecovery: z
    .object({
      id: z.string(),
      amount: decimal,
      status: z.string(),
      employeeId: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type FuelException = z.infer<typeof fuelExceptionSchema>;

export async function listFuelExceptions(status?: FuelExceptionStatus) {
  const query = status ? `?status=${status}` : '';
  return z
    .array(fuelExceptionSchema)
    .parse(await authFetch<unknown>(`/plant/fuel/exceptions${query}`));
}

/**
 * Raises an exception for every alerted reading that has none.
 *
 * Idempotent on the server — a unique index on the fuel entry means running it twice raises nothing
 * the second time — so the screen can offer it without guarding against a double click.
 */
export async function raiseFuelExceptions() {
  return z.object({ raised: z.number() }).parse(
    await authFetch<unknown>('/plant/fuel/exceptions/raise', {
      method: 'POST',
    }),
  );
}

export interface ReviewFuelExceptionInput {
  status: 'confirmed' | 'dismissed';
  attribution?: FuelAttribution;
  operatorEmployeeId?: string;
  reason?: string;
}

/**
 * Confirms with an attribution, or dismisses with a reason. **Moves no money.**
 *
 * Its refusals carry codes — `FUEL_EXCEPTION_REASON_REQUIRED`,
 * `FUEL_EXCEPTION_ATTRIBUTION_REQUIRED`, `FUEL_EXCEPTION_NOT_HIRED`,
 * `FUEL_EXCEPTION_OPERATOR_REQUIRED` — and the last one also carries `candidates`, the operators
 * who ran the machine that day. Read it from `ApiError.details`; the screen offers them rather than
 * sending somebody to the logbook to look them up.
 */
export async function reviewFuelException(
  id: string,
  input: ReviewFuelExceptionInput,
) {
  return fuelExceptionSchema.partial().parse(
    await authFetch<unknown>(`/plant/fuel/exceptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

/**
 * Deducts a confirmed loss from the hire bill (FR-003, FR-004).
 *
 * No approval chain: a hire bill is a document the company is still assembling, and an adjustment
 * before payment is not money leaving. A paid bill is never adjusted — the server carries the
 * recovery to the next unpaid bill for the same equipment and vendor.
 */
export async function recoverFromHireBill(exceptionId: string) {
  return authFetch<unknown>(
    `/plant/fuel-exceptions/${exceptionId}/recover/hire-bill`,
    { method: 'POST' },
  );
}

/**
 * Recovers a confirmed loss from the operator's salary (FR-005, FR-006).
 *
 * **Raises a proposal, not a deduction.** It reaches no payroll line until the chain approves it,
 * which is a property of the payroll query rather than a check somebody could omit.
 */
export async function recoverFromOperator(exceptionId: string) {
  return authFetch<unknown>(
    `/plant/fuel-exceptions/${exceptionId}/recover/operator`,
    { method: 'POST' },
  );
}
