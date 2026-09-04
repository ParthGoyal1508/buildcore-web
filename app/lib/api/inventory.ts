import { z } from 'zod';

import {
  INDENT_STATUSES,
  ITEM_UNITS,
  PAYMENT_MODES,
  PURCHASE_BILL_STATUSES,
  TRANSFER_STATUSES,
} from '@/app/lib/constants';
import { authFetch, authFetchBlob } from '@/app/lib/session';

/**
 * Every `/dashboard/inventory/*` call to `buildcore-api` (feature 009).
 *
 * One module per domain, per Constitution Principle V — no component issues its own
 * `fetch()`. Every response is parsed through a `zod` schema before the app trusts
 * it (Principle IV), and the `z.infer` type is what the UI consumes.
 *
 * **Every schema below was checked against a response the running API actually
 * returned**, not against `data-model.md` and not against the Prisma models. Feature
 * 005 shipped six bugs of exactly one kind by doing the opposite, and 008 caught a
 * string-vs-number `contractValue` the same way. The backend converts its `Decimal`
 * columns to numbers for this module specifically, but the coercion below stays
 * anyway: it costs nothing and it is what stops the next endpoint that forgets from
 * becoming a blank screen.
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
    v === null ? null : typeof v === 'number' ? v : v.trim() === '' ? null : Number(v),
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

// ─────────────────────────────────────────────────────────────────────────────
// Item categories
// ─────────────────────────────────────────────────────────────────────────────

export const itemCategorySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  itemCount: z.number(),
});
export type ItemCategory = z.infer<typeof itemCategorySchema>;

export async function getCategories(): Promise<ItemCategory[]> {
  const raw = await authFetch<unknown>('/inventory/categories');
  return z.array(itemCategorySchema).parse(raw);
}

export async function createCategory(name: string): Promise<ItemCategory> {
  const raw = await authFetch<unknown>('/inventory/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return itemCategorySchema.parse(raw);
}

export async function updateCategory(
  id: string,
  name: string,
): Promise<ItemCategory> {
  const raw = await authFetch<unknown>(`/inventory/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
  return itemCategorySchema.parse(raw);
}

export async function deleteCategory(id: string): Promise<void> {
  await authFetch<void>(`/inventory/categories/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Items
// ─────────────────────────────────────────────────────────────────────────────

export const itemSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  unit: z.string(),
  reorderLevel: nullableDecimal,
  hsnCode: z.string().nullable(),
  description: z.string().nullable(),
  active: z.boolean(),
});
export type Item = z.infer<typeof itemSchema>;

export const itemPageSchema = z.object({
  items: z.array(itemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type ItemPage = z.infer<typeof itemPageSchema>;

export interface ItemQuery {
  search?: string;
  categoryId?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

export async function getItems(query: ItemQuery = {}): Promise<ItemPage> {
  const raw = await authFetch<unknown>(`/inventory/items${qs({ ...query })}`);
  return itemPageSchema.parse(raw);
}

export interface ItemInput {
  name: string;
  categoryId: string;
  unit: (typeof ITEM_UNITS)[number];
  reorderLevel?: number;
  hsnCode?: string;
  description?: string;
  active?: boolean;
}

export async function createItem(input: ItemInput): Promise<Item> {
  const raw = await authFetch<unknown>('/inventory/items', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return itemSchema.parse(raw);
}

export async function updateItem(
  id: string,
  input: Partial<ItemInput>,
): Promise<Item> {
  const raw = await authFetch<unknown>(`/inventory/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return itemSchema.parse(raw);
}

export async function deleteItem(id: string): Promise<void> {
  await authFetch<void>(`/inventory/items/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Stock
// ─────────────────────────────────────────────────────────────────────────────

export const stockRowSchema = z.object({
  itemId: z.string(),
  itemName: z.string(),
  itemCode: z.string(),
  siteId: z.string(),
  siteName: z.string(),
  category: z.string(),
  unit: z.string(),
  received: decimal,
  issued: decimal,
  transferIn: decimal,
  transferOut: decimal,
  inStock: decimal,
  avgRate: decimal,
  stockValue: decimal,
  reorderLevel: nullableDecimal,
  belowReorderLevel: z.boolean(),
});
export type StockRow = z.infer<typeof stockRowSchema>;

export const stockPageSchema = z.object({
  rows: z.array(stockRowSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type StockPage = z.infer<typeof stockPageSchema>;

export interface StockQuery {
  siteId?: string;
  categoryId?: string;
  search?: string;
  belowReorderLevel?: boolean;
  page?: number;
  pageSize?: number;
}

export async function getStock(query: StockQuery = {}): Promise<StockPage> {
  const raw = await authFetch<unknown>(`/inventory/stock${qs({ ...query })}`);
  return stockPageSchema.parse(raw);
}

export const stockHintSchema = z.object({
  itemId: z.string(),
  siteId: z.string(),
  inStock: decimal,
  avgRate: decimal,
  unit: z.string().nullable(),
});
export type StockHint = z.infer<typeof stockHintSchema>;

export async function getStockHint(
  itemId: string,
  siteId: string,
): Promise<StockHint> {
  const raw = await authFetch<unknown>(
    `/inventory/stock/${encodeURIComponent(itemId)}/${encodeURIComponent(siteId)}`,
  );
  return stockHintSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Purchases
// ─────────────────────────────────────────────────────────────────────────────

export const purchaseSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  siteName: z.string(),
  itemId: z.string(),
  itemName: z.string(),
  itemCode: z.string(),
  unit: z.string(),
  vendorId: z.string(),
  vendorName: z.string(),
  date: isoDate,
  quantity: decimal,
  rate: decimal,
  amount: decimal,
  grnNumber: z.string().nullable(),
  hasBillFile: z.boolean(),
  paymentStatus: z.enum(PURCHASE_BILL_STATUSES).nullable(),
  paidAmount: decimal,
  indentLineId: z.string().nullable(),
  remarks: z.string().nullable(),
});
export type Purchase = z.infer<typeof purchaseSchema>;

export const purchasePageSchema = z.object({
  purchases: z.array(purchaseSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type PurchasePage = z.infer<typeof purchasePageSchema>;

export interface PurchaseQuery {
  siteId?: string;
  vendorId?: string;
  itemId?: string;
  paymentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function getPurchases(
  query: PurchaseQuery = {},
): Promise<PurchasePage> {
  const raw = await authFetch<unknown>(`/inventory/purchases${qs({ ...query })}`);
  return purchasePageSchema.parse(raw);
}

export interface PurchaseInput {
  siteId: string;
  itemId: string;
  vendorId: string;
  date: string;
  quantity: number;
  rate: number;
  /** Base64, without a data-URL prefix. The API takes the bill in the JSON body
   * rather than as multipart, matching 007's contractor documents. */
  billFile?: string;
  billContentType?: string;
  indentLineId?: string;
  remarks?: string;
}

export async function createPurchase(input: PurchaseInput): Promise<Purchase> {
  const raw = await authFetch<unknown>('/inventory/purchases', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return purchaseSchema.parse(raw);
}

export async function deletePurchase(id: string): Promise<void> {
  await authFetch<void>(`/inventory/purchases/${id}`, { method: 'DELETE' });
}

/**
 * The uploaded bill, as a blob the caller can hand to the browser.
 *
 * Not a plain `<a href>`: the endpoint is behind the bearer token, which lives in
 * memory and never reaches a URL. So the file is fetched with the same auth every
 * other call uses and handed over as an object URL.
 */
export async function getPurchaseBill(id: string): Promise<Blob> {
  return authFetchBlob(`/inventory/purchases/${id}/bill`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Issues
// ─────────────────────────────────────────────────────────────────────────────

export const issueSchema = z.object({
  id: z.string(),
  siteId: z.string(),
  siteName: z.string(),
  itemId: z.string(),
  itemName: z.string(),
  itemCode: z.string(),
  unit: z.string(),
  date: isoDate,
  quantity: decimal,
  issuedTo: z.string(),
  activityId: z.string().nullable(),
  boqItemId: z.string().nullable(),
  indentLineId: z.string().nullable(),
  remarks: z.string().nullable(),
});
export type Issue = z.infer<typeof issueSchema>;

export const issuePageSchema = z.object({
  issues: z.array(issueSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type IssuePage = z.infer<typeof issuePageSchema>;

export interface IssueQuery {
  siteId?: string;
  itemId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function getIssues(query: IssueQuery = {}): Promise<IssuePage> {
  const raw = await authFetch<unknown>(`/inventory/issues${qs({ ...query })}`);
  return issuePageSchema.parse(raw);
}

export interface IssueInput {
  siteId: string;
  itemId: string;
  date: string;
  quantity: number;
  issuedTo: string;
  activityId?: string;
  boqItemId?: string;
  indentLineId?: string;
  remarks?: string;
}

export async function createIssue(input: IssueInput): Promise<Issue> {
  const raw = await authFetch<unknown>('/inventory/issues', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return issueSchema.parse(raw);
}

export async function deleteIssue(id: string): Promise<void> {
  await authFetch<void>(`/inventory/issues/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfers
// ─────────────────────────────────────────────────────────────────────────────

export const transferSchema = z.object({
  id: z.string(),
  fromSiteId: z.string(),
  fromSiteName: z.string(),
  toSiteId: z.string(),
  toSiteName: z.string(),
  itemId: z.string(),
  itemName: z.string(),
  itemCode: z.string(),
  unit: z.string(),
  date: isoDate,
  quantity: decimal,
  status: z.enum(TRANSFER_STATUSES),
  remarks: z.string().nullable(),
});
export type Transfer = z.infer<typeof transferSchema>;

export const transferPageSchema = z.object({
  transfers: z.array(transferSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type TransferPage = z.infer<typeof transferPageSchema>;

export interface TransferQuery {
  fromSiteId?: string;
  toSiteId?: string;
  itemId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function getTransfers(
  query: TransferQuery = {},
): Promise<TransferPage> {
  const raw = await authFetch<unknown>(`/inventory/transfers${qs({ ...query })}`);
  return transferPageSchema.parse(raw);
}

export interface TransferInput {
  fromSiteId: string;
  toSiteId: string;
  itemId: string;
  date: string;
  quantity: number;
  remarks?: string;
}

export async function createTransfer(input: TransferInput): Promise<Transfer> {
  const raw = await authFetch<unknown>('/inventory/transfers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return transferSchema.parse(raw);
}

export async function updateTransferStatus(
  id: string,
  status: (typeof TRANSFER_STATUSES)[number],
): Promise<{ id: string; status: string }> {
  const raw = await authFetch<unknown>(`/inventory/transfers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return z.object({ id: z.string(), status: z.string() }).parse(raw);
}

export async function deleteTransfer(id: string): Promise<void> {
  await authFetch<void>(`/inventory/transfers/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Payments and bills
// ─────────────────────────────────────────────────────────────────────────────

export const paymentSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  vendorName: z.string(),
  amount: decimal,
  date: isoDate,
  paymentMode: z.enum(PAYMENT_MODES),
  referenceNumber: z.string(),
  allocatedAmount: decimal,
  unallocatedBalance: decimal,
  allocatedBillCount: z.number(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const paymentPageSchema = z.object({
  payments: z.array(paymentSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type PaymentPage = z.infer<typeof paymentPageSchema>;

export interface PaymentQuery {
  vendorId?: string;
  paymentMode?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function getPayments(
  query: PaymentQuery = {},
): Promise<PaymentPage> {
  const raw = await authFetch<unknown>(`/inventory/payments${qs({ ...query })}`);
  return paymentPageSchema.parse(raw);
}

/** No `allocations` field: FIFO allocation is entirely server-side (FR-005). */
export interface PaymentInput {
  vendorId: string;
  amount: number;
  date: string;
  paymentMode: (typeof PAYMENT_MODES)[number];
  referenceNumber: string;
}

export async function createPayment(input: PaymentInput): Promise<Payment> {
  const raw = await authFetch<unknown>('/inventory/payments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return paymentSchema.parse(raw);
}

export async function deletePayment(id: string): Promise<void> {
  await authFetch<void>(`/inventory/payments/${id}`, { method: 'DELETE' });
}

export const billSchema = z.object({
  id: z.string(),
  purchaseId: z.string(),
  vendorId: z.string(),
  vendorName: z.string(),
  billDate: isoDate,
  totalAmount: decimal,
  paidAmount: decimal,
  outstanding: decimal,
  paymentStatus: z.enum(PURCHASE_BILL_STATUSES),
});
export type Bill = z.infer<typeof billSchema>;

export const billListSchema = z.object({
  bills: z.array(billSchema),
  totalOutstanding: decimal,
});
export type BillList = z.infer<typeof billListSchema>;

/**
 * A vendor's outstanding bills and their total.
 *
 * The payment form shows only the total, as an informational label — allocation is
 * automatic, so there is nothing here for the user to choose (FR-004).
 */
export async function getVendorBills(vendorId: string): Promise<BillList> {
  const raw = await authFetch<unknown>(`/inventory/bills${qs({ vendorId })}`);
  return billListSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// Material indents
// ─────────────────────────────────────────────────────────────────────────────

export const indentLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  itemName: z.string(),
  itemCode: z.string(),
  unit: z.string(),
  requestedQuantity: decimal,
  approvedQuantity: nullableDecimal,
  fulfilledQuantity: decimal,
  outstandingQuantity: nullableDecimal,
  reductionReason: z.string().nullable(),
  activityId: z.string().nullable(),
  boqItemId: z.string().nullable(),
  procurementPending: z.boolean(),
});
export type IndentLine = z.infer<typeof indentLineSchema>;

export const indentSchema = z.object({
  id: z.string(),
  indentNumber: z.string(),
  siteId: z.string(),
  siteName: z.string(),
  projectId: z.string().nullable(),
  requiredByDate: isoDate,
  justification: z.string(),
  status: z.enum(INDENT_STATUSES),
  requestedByUserId: z.string(),
  approvedByUserId: z.string().nullable(),
  approvedAt: z.string().nullable(),
  decisionReason: z.string().nullable(),
  overdue: z.boolean(),
  overdueByDays: z.number(),
  lines: z.array(indentLineSchema),
});
export type Indent = z.infer<typeof indentSchema>;

export const indentPageSchema = z.object({
  indents: z.array(indentSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type IndentPage = z.infer<typeof indentPageSchema>;

export interface IndentQuery {
  status?: string;
  siteId?: string;
  projectId?: string;
  itemId?: string;
  page?: number;
  pageSize?: number;
}

export async function getIndents(
  query: IndentQuery = {},
): Promise<IndentPage> {
  const raw = await authFetch<unknown>(`/inventory/indents${qs({ ...query })}`);
  return indentPageSchema.parse(raw);
}

export async function getIndent(id: string): Promise<Indent> {
  const raw = await authFetch<unknown>(`/inventory/indents/${id}`);
  return indentSchema.parse(raw);
}

export interface IndentInput {
  siteId: string;
  requiredByDate: string;
  justification: string;
  lines: {
    itemId: string;
    requestedQuantity: number;
    activityId?: string;
    boqItemId?: string;
  }[];
}

export async function createIndent(input: IndentInput): Promise<Indent> {
  const raw = await authFetch<unknown>('/inventory/indents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return indentSchema.parse(raw);
}

export interface ApproveIndentInput {
  lines: {
    lineId: string;
    approvedQuantity: number;
    reductionReason?: string;
  }[];
}

export async function approveIndent(
  id: string,
  input: ApproveIndentInput,
): Promise<Indent> {
  const raw = await authFetch<unknown>(`/inventory/indents/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return indentSchema.parse(raw);
}

export async function rejectIndent(
  id: string,
  reason: string,
): Promise<Indent> {
  const raw = await authFetch<unknown>(`/inventory/indents/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return indentSchema.parse(raw);
}

export async function cancelIndent(
  id: string,
  reason: string,
): Promise<Indent> {
  const raw = await authFetch<unknown>(`/inventory/indents/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return indentSchema.parse(raw);
}

export async function markProcurementNeeded(
  id: string,
  lineIds: string[],
): Promise<Indent> {
  const raw = await authFetch<unknown>(
    `/inventory/indents/${id}/mark-procurement-needed`,
    { method: 'POST', body: JSON.stringify({ lineIds }) },
  );
  return indentSchema.parse(raw);
}

export async function deleteIndent(id: string): Promise<void> {
  await authFetch<void>(`/inventory/indents/${id}`, { method: 'DELETE' });
}

/**
 * What needs buying, from two independent sources.
 *
 * Two lists, never one total: the same item can appear in both — a site indented it
 * *and* the store is below its reorder level — and adding them would order it twice
 * (FR-027). The response shape enforces that; the UI must not undo it.
 */
export const procurementNeededSchema = z.object({
  indentDemand: z.array(
    z.object({
      indentId: z.string(),
      indentNumber: z.string(),
      lineId: z.string(),
      itemId: z.string(),
      itemName: z.string(),
      itemCode: z.string(),
      unit: z.string(),
      siteId: z.string(),
      siteName: z.string(),
      outstandingQuantity: decimal,
      requiredByDate: isoDate,
    }),
  ),
  reorderShortfall: z.array(
    z.object({
      itemId: z.string(),
      itemName: z.string(),
      itemCode: z.string(),
      unit: z.string(),
      siteId: z.string(),
      siteName: z.string(),
      inStock: decimal,
      reorderLevel: decimal,
      shortfall: decimal,
    }),
  ),
});
export type ProcurementNeeded = z.infer<typeof procurementNeededSchema>;

export async function getProcurementNeeded(): Promise<ProcurementNeeded> {
  const raw = await authFetch<unknown>('/inventory/indents/procurement-needed');
  return procurementNeededSchema.parse(raw);
}
