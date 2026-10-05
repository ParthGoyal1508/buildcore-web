import { z } from 'zod';

import {
  CLIENT_STATUSES,
  PROJECT_DIVISIONS,
  PROJECT_SITE_TYPES,
  PROJECT_STATUSES,
  SITE_STATUSES,
} from '@/app/lib/constants';
import { authFetch } from '@/app/lib/session';
import { projectReadinessSchema } from '@/app/lib/api/project-documents';

/**
 * Every `/dashboard/projects/*` call to `buildcore-api` (feature 008).
 *
 * One module per domain, per Constitution Principle V — no component issues its own
 * `fetch()`. Every response is parsed through a `zod` schema before the app trusts
 * it (Principle IV), and the `z.infer` type is what the UI consumes.
 *
 * Scoped to User Stories 1–3, **and User Story 5's BOQ since 2026-10-03** — the endpoints it
 * calls were built that day, because nothing in either repository could write a BOQ and 018's
 * billing screens had been measuring against a table nothing could fill.
 *
 * **Daily work reports moved out on 2026-10-05**, to `app/lib/api/dwr.ts`: feature 022 built the
 * fourteen endpoints, so the promise this file could not keep is now keepable and is kept next
 * door. Revenue and budget still have no functions here, for the original reason — a typed stub
 * against an absent endpoint is a compile-time promise the runtime cannot keep.
 *
 * Schemas validate the fields the UI reads and let `zod` strip the rest, the same
 * choice `partners.ts` and `hr-payroll.ts` document: several routes return full
 * Prisma rows, and enumerating every column would duplicate `schema.prisma` and go
 * stale on the first migration.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A money value on the wire.
 *
 * Prisma `Decimal` columns serialise as strings, while a service-computed figure
 * arrives as a number — `contractValue` is the former and `totalReceived` the
 * latter, from the same endpoint. Coercing here means no component has to know
 * which is which. In **rupees**, not paise (see `formatRupees`).
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

const isoDate = z.string();
const nullableIsoDate = z.string().nullable();

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

/** The envelope every paginated list in this module returns. */
const pageOf = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
  });

// ─────────────────────────────────────────────────────────────────────────────
// Clients (US1)
// ─────────────────────────────────────────────────────────────────────────────

export const clientSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  contactPerson: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  gstin: z.string().nullable(),
  status: z.enum(CLIENT_STATUSES),
});
export type Client = z.infer<typeof clientSchema>;

/**
 * A row in the client list.
 *
 * Carries `projectCount`, which the detail response does not: the list uses it to
 * disable Delete before the user clicks it, rather than letting them discover the
 * refusal from a 409.
 */
export const clientListItemSchema = clientSchema
  .omit({ companyId: true, address: true })
  .extend({ projectCount: z.number() });
export type ClientListItem = z.infer<typeof clientListItemSchema>;

export const clientPageSchema = pageOf(clientListItemSchema);
export type ClientPage = z.infer<typeof clientPageSchema>;

export interface ClientQuery {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function getClients(query: ClientQuery = {}): Promise<ClientPage> {
  const raw = await authFetch<unknown>(`/projects/clients${qs({ ...query })}`);
  return clientPageSchema.parse(raw);
}

export interface ClientInput {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  status?: string;
}

export async function createClient(input: ClientInput): Promise<Client> {
  const raw = await authFetch<unknown>('/projects/clients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return clientSchema.parse(raw);
}

export async function updateClient(
  id: string,
  input: Partial<ClientInput>,
): Promise<Client> {
  const raw = await authFetch<unknown>(`/projects/clients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return clientSchema.parse(raw);
}

export async function deleteClient(id: string): Promise<void> {
  await authFetch<unknown>(`/projects/clients/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sites (US2)
// ─────────────────────────────────────────────────────────────────────────────

export const siteSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  // Geofence data owned by feature 003 and untouched by 008. Decimal columns, so
  // they arrive as strings.
  latitude: decimal,
  longitude: decimal,
  geofenceRadiusMeters: z.number(),
  weeklyOffDay: z.number(),
  projectId: z.string().nullable(),
  address: z.string().nullable(),
  status: z.enum(SITE_STATUSES),
});
export type Site = z.infer<typeof siteSchema>;

export const sitePageSchema = pageOf(siteSchema);
export type SitePage = z.infer<typeof sitePageSchema>;

export interface SiteQuery {
  search?: string;
  projectId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/**
 * The paginated administrative list.
 *
 * `/projects/sites/list`, not `/projects/sites` — that route is feature 003's site
 * picker and still returns a bare `{ id, name }[]` that HR's employee form reads
 * directly. 008 added this alongside it rather than changing the shape underneath a
 * working form.
 */
export async function getSites(query: SiteQuery = {}): Promise<SitePage> {
  const raw = await authFetch<unknown>(`/projects/sites/list${qs({ ...query })}`);
  return sitePageSchema.parse(raw);
}

export interface SiteInput {
  name: string;
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
  weeklyOffDay: number;
  projectId?: string | null;
  address?: string;
  status?: string;
}

export async function createSite(input: SiteInput): Promise<Site> {
  const raw = await authFetch<unknown>('/projects/sites', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return siteSchema.parse(raw);
}

export async function updateSite(
  id: string,
  input: Partial<SiteInput>,
): Promise<Site> {
  const raw = await authFetch<unknown>(`/projects/sites/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return siteSchema.parse(raw);
}

export async function deleteSite(id: string): Promise<void> {
  await authFetch<unknown>(`/projects/sites/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio (US3)
// ─────────────────────────────────────────────────────────────────────────────

/** A row in the portfolio list — flattened, with the client already resolved to a name. */
export const projectListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  client: z.string(),
  location: z.string().nullable(),
  contractValue: decimal,
  status: z.enum(PROJECT_STATUSES),
  startDate: isoDate,
  expectedEndDate: nullableIsoDate,
  isLocked: z.boolean(),
  /**
   * How far the project is from fully papered (017 FR-008).
   *
   * Present only when the caller asked for `include=documentReadiness`, so it is
   * optional here rather than nullable — a list that did not ask has no opinion, which
   * is different from asking and being told nothing is required.
   *
   * It arrives **inside this response**, in one request for the whole page. Fetching it
   * per row is the N+1 the backend's batch form exists to prevent, and quickstart Pass 7
   * counts the requests in the Network tab expecting one.
   */
  documentReadiness: projectReadinessSchema.optional(),
});
export type ProjectListItem = z.infer<typeof projectListItemSchema>;

export const projectPageSchema = pageOf(projectListItemSchema);
export type ProjectPage = z.infer<typeof projectPageSchema>;

/** The full row, as create/update return it and the edit form reads it. */
export const projectSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  clientId: z.string(),
  location: z.string().nullable(),
  contractValue: decimal,
  startDate: isoDate,
  expectedEndDate: nullableIsoDate,
  status: z.enum(PROJECT_STATUSES),
  projectManagerEmployeeId: z.string().nullable(),
  division: z.enum(PROJECT_DIVISIONS),
  departmentType: z.string().nullable(),
  projectType: z.string().nullable(),
  siteType: z.enum(PROJECT_SITE_TYPES),
  isHO: z.boolean(),
  isLocked: z.boolean(),
  siteStartDate: nullableIsoDate,
  purchaseLimit: nullableDecimal,
  orderNumber: z.string().nullable(),
  cgstApplicable: z.boolean(),
  /**
   * The client contract's retention term as a **fraction** — `0.05` is 5%, and `null` means no
   * term has been recorded, which is not the same as zero: composing a bill to the client is
   * refused until it is set.
   */
  clientRetentionFraction: decimal.nullable().optional(),
  description: z.string().nullable(),
});
export type Project = z.infer<typeof projectSchema>;

export interface ProjectQuery {
  search?: string;
  status?: string;
  clientId?: string;
  page?: number;
  pageSize?: number;
  /**
   * Comma-separated extras. Pass `INCLUDE_DOCUMENT_READINESS` to attach each project's
   * document readiness to its row (017 FR-008). Opt-in because it costs the server two
   * extra queries, and the screens that do not show it should not pay for them.
   */
  include?: string;
}

export async function getProjects(
  query: ProjectQuery = {},
): Promise<ProjectPage> {
  const raw = await authFetch<unknown>(`/projects${qs({ ...query })}`);
  return projectPageSchema.parse(raw);
}

/**
 * What `GET /projects/:id` has been returning all along (008 US4).
 *
 * Until 2026-10-04 this app parsed `raw.project` and threw the rest away, with a comment
 * saying the tabs belonged to a detail page that was not built. The detail page is now the
 * project shell under `portfolio/[id]/`, so the aggregate is read.
 *
 * `unavailableModules` is the field worth understanding before reading any of the arrays. An
 * empty `machinery` with `plant` named in the list means **we could not ask**; an empty
 * `machinery` without it means **we asked and there is none**. The server computes the
 * distinction deliberately (see `ProjectDetail` in `projects.service.ts`) and a screen that
 * renders both as "No machinery on this project" throws away the only warning that a module is
 * missing from the deployment.
 */
export const projectDetailSchema = z.object({
  project: projectSchema,
  tabs: z.object({
    employees: z.array(
      z.object({
        id: z.string(),
        employeeCode: z.string(),
        name: z.string(),
        designationId: z.string().nullable(),
      }),
    ),
    machinery: z.array(
      z.object({
        id: z.string(),
        code: z.string(),
        name: z.string(),
        status: z.string(),
        deployedSiteId: z.string().nullable(),
        utilizationPercent: decimal,
      }),
    ),
    materials: z.array(
      z.object({
        itemId: z.string(),
        itemName: z.string(),
        itemCode: z.string(),
        unit: z.string(),
        issuedQuantity: decimal,
      }),
    ),
    dwrSummary: z.object({ count: z.number(), latestDate: nullableIsoDate }),
    billSummary: z.object({
      totalBills: z.number(),
      totalExpenses: decimal,
    }),
    revenueSummary: z.object({
      totalReceived: decimal,
      totalPending: decimal,
    }),
  }),
  unavailableModules: z.array(z.string()),
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

/**
 * One project and everything the shell shows about it, in a single request.
 *
 * Fetched once by `portfolio/[id]/layout.tsx` and handed to every section through
 * `ProjectShellContext`, so moving between Overview, BOQ, Documents and the money screens
 * costs nothing. It keeps the `['projects', 'portfolio', id]` key the six section pages
 * already used and that `boq-import` already invalidates — an import can set the project's
 * quoted percentage, and the header above it must not go on showing the old one.
 */
export async function getProjectDetail(id: string): Promise<ProjectDetail> {
  const raw = await authFetch<unknown>(`/projects/${id}`);
  return projectDetailSchema.parse(raw);
}

export interface ProjectInput {
  code?: string;
  name: string;
  clientId: string;
  location?: string;
  contractValue: number;
  startDate: string;
  expectedEndDate?: string;
  status?: string;
  projectManagerEmployeeId?: string | null;
  division?: string;
  departmentType?: string;
  projectType?: string;
  siteType?: string;
  isHO?: boolean;
  siteStartDate?: string;
  purchaseLimit?: number;
  orderNumber?: string;
  cgstApplicable?: boolean;
  /** A fraction — the form collects a percentage and divides by 100 before sending. */
  clientRetentionFraction?: number;
  description?: string;
  isLocked?: boolean;
  /**
   * Documents staged before this project existed (017 FR-009, FR-009b).
   *
   * FR-009 refuses to create a project while a mandatory kind has no document attached — so the
   * documents must exist before the project does. Each id comes from
   * `stageProjectDocument`, and creation converts them into the project's own documents inside
   * the same transaction: if the creation is refused, nothing was filed and nothing was created.
   *
   * Creation-only. There is no equivalent on update, because by then the project exists and
   * `POST /projects/:id/documents` is the ordinary path.
   */
  stagedDocumentIds?: string[];
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const raw = await authFetch<unknown>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return projectSchema.parse(raw);
}

export async function updateProject(
  id: string,
  input: Partial<ProjectInput>,
): Promise<Project> {
  const raw = await authFetch<unknown>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return projectSchema.parse(raw);
}

export async function deleteProject(id: string): Promise<void> {
  await authFetch<unknown>(`/projects/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOQ — entry, the tree, the four alert groups, and the tender import
// (008 US4/US5, amended 2026-10-03)
//
// The module note at the top of this file says BOQ "has no functions here, because the endpoints
// they would call do not exist yet". They exist now: nothing in either repository could write a
// BOQ, which is why 018's billing screens have been measuring against a table nothing could fill.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every state one line can be in — five, of which four are alerts (api FR-048).
 *
 * `onTrack` is the absence of an alert: a line inside its dates and keeping pace, or finished
 * before its finish date, needs nobody's attention. It appears on the tree and in none of the
 * alert groups.
 */
export const BOQ_LINE_STATES = [
  'today',
  'delayed',
  'toBeDelayed',
  'unplanned',
  'onTrack',
] as const;

const boqItemSchema = z.object({
  id: z.string(),
  boqNo: z.string(),
  taskName: z.string(),
  /**
   * As the source spelled it (api FR-041).
   *
   * Displayed verbatim and never tidied: the client reconciles against their own sheet, and
   * silently rewriting `R. mtr` to `R.Mtr.` creates a difference they cannot trace.
   */
  unit: z.string(),
  scopeQty: decimal,
  rate: decimal,
  doneQty: decimal,
  pendingQty: decimal,
  /**
   * **`.nullable()` deliberately, and this is the sixth time this class of defect has appeared
   * in this project.** A nullable the schema treats as required fails the whole read; a nullable
   * the schema omits loses exactly the distinction FR-026 exists to draw. Null means *unplanned*,
   * which is not zero: "achieving nothing" and "nobody has set a target" are different claims.
   */
  perDayQty: decimal.nullable(),
  avgQtyPerDay: decimal.nullable(),
  daysToComplete: z.number().nullable(),
  startDate: z.string().nullable(),
  finishDate: z.string().nullable(),
  isVariation: z.boolean(),
  state: z.enum(BOQ_LINE_STATES),
});

const boqGroupSchema = z.object({
  id: z.string(),
  boqNo: z.string(),
  name: z.string(),
  scopeQty: decimal,
  startDate: z.string().nullable(),
  finishDate: z.string().nullable(),
  items: z.array(boqItemSchema),
});

export type BoqItem = z.infer<typeof boqItemSchema>;
export type BoqGroup = z.infer<typeof boqGroupSchema>;

const boqAlertsSchema = z.object({
  today: z.array(boqItemSchema),
  delayed: z.array(boqItemSchema),
  toBeDelayed: z.array(boqItemSchema),
  /** The normal state of a freshly imported tender, and reported rather than hidden. */
  unplanned: z.array(boqItemSchema),
});

export type BoqAlerts = z.infer<typeof boqAlertsSchema>;

/** A rejected row, or a row accepted with something worth saying about it. */
const rowProblemSchema = z.object({
  row: z.number(),
  column: z.string(),
  reason: z.string(),
});

const importTotalsSchema = z.object({
  /** Computed from the lines, never read from the file (api FR-044). */
  scheduleDerived: decimal,
  /** What the workbook says about itself, where it says anything. */
  scheduleStated: decimal.nullable(),
  quotedDerived: decimal.nullable(),
  quotedStated: decimal.nullable(),
  scheduleDifference: decimal.nullable(),
  quotedDifference: decimal.nullable(),
  /** One paisa per line — derived from the rounding rather than chosen (api FR-045). */
  tolerance: decimal,
  reconciles: z.boolean(),
});

const importReportSchema = z.object({
  batchId: z.string(),
  sheetName: z.string(),
  groups: z.number(),
  lines: z.number(),
  units: z.array(
    z.object({ asTyped: z.string(), normalised: z.string(), lines: z.number() }),
  ),
  totals: importTotalsSchema,
  /**
   * **Null means "not found", and is never 0** (api FR-040). Zero is a valid percentage, so a
   * schema that defaulted this would turn a failed read into a tender quoted at the schedule of
   * rates exactly — which under-bills every line on the project.
   */
  quotedPercentage: decimal.nullable(),
  quotedPercentageFound: z.boolean(),
  errors: z.array(rowProblemSchema),
  /** Separate from `errors`: a line grouped under the sheet name is not a rejected row. */
  warnings: z.array(rowProblemSchema),
  alerts: z.object({
    today: z.number(),
    delayed: z.number(),
    toBeDelayed: z.number(),
    unplanned: z.number(),
  }),
});

export type BoqImportReport = z.infer<typeof importReportSchema>;

export interface BoqGroupInput {
  boqNo: string;
  name: string;
  scopeQty: string;
  /** Omitted until somebody plans the work (api FR-037). */
  startDate?: string;
  finishDate?: string;
}

export interface BoqItemInput {
  groupId: string;
  boqNo: string;
  taskName: string;
  unit: string;
  scopeQty: string;
  rate?: string;
  startDate?: string;
  finishDate?: string;
  duration?: number;
  perDayQty?: string;
}

export async function getBOQ(projectId: string): Promise<BoqGroup[]> {
  const raw = await authFetch<unknown>(`/projects/${projectId}/boq`);
  return z.array(boqGroupSchema).parse(raw);
}

export async function getBOQAlerts(projectId: string): Promise<BoqAlerts> {
  const raw = await authFetch<unknown>(`/projects/${projectId}/boq/alerts`);
  return boqAlertsSchema.parse(raw);
}

export async function createBOQGroup(projectId: string, input: BoqGroupInput) {
  return authFetch<{ id: string }>(`/projects/${projectId}/boq/groups`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createBOQItem(projectId: string, input: BoqItemInput) {
  return authFetch<{ id: string }>(`/projects/${projectId}/boq/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Gives an existing line its programme (025 FR-009).
 *
 * **`null` clears a field; leaving it out leaves the field alone.** The two are different
 * intentions and the API keeps them apart, so this signature does too: `undefined` is never sent,
 * and a `null` reaching the wire is a deliberate clear.
 *
 * Only these four. Scope, rate, unit and description are not accepted by the endpoint at all — a
 * programme is *when* the work happens, and those are *what the work is*.
 */
export async function planBOQItem(
  projectId: string,
  itemId: string,
  input: {
    startDate?: string | null;
    finishDate?: string | null;
    duration?: number | null;
    perDayQty?: string | null;
  },
): Promise<BoqItem> {
  const raw = await authFetch<unknown>(
    `/projects/${projectId}/boq/items/${itemId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return boqItemSchema.parse(raw);
}

export async function deleteBOQItem(projectId: string, itemId: string): Promise<void> {
  await authFetch<unknown>(`/projects/${projectId}/boq/items/${itemId}`, {
    method: 'DELETE',
  });
}

/**
 * Reads a tender workbook and reports what it says, writing nothing.
 *
 * **Base64 in JSON rather than `FormData`**, matching every other upload in this application —
 * feature 015 established that there is no `FormData` anywhere here, and the API takes base64 for
 * company documents, equipment photos, purchase bills and payment attachments for the same reason.
 */
export async function validateBOQImport(
  projectId: string,
  file: File,
): Promise<BoqImportReport> {
  const base64 = await fileToBase64(file);
  const raw = await authFetch<unknown>(`/projects/${projectId}/boq/import/validate`, {
    method: 'POST',
    body: JSON.stringify({ file: base64 }),
  });
  return importReportSchema.parse(raw);
}

/**
 * Reads an **internal estimate** workbook (025 FR-032).
 *
 * Identical to the tender import in every refusal and every figure. The difference is what the
 * confirmed rows mean: an estimate is **not billable**, is absent from the alert groups, and does
 * not set the project's quoted percentage — so importing one up the tender path would put
 * unbillable lines into a bill.
 */
export async function validateEstimateImport(
  projectId: string,
  file: File,
): Promise<BoqImportReport> {
  const base64 = await fileToBase64(file);
  const raw = await authFetch<unknown>(
    `/projects/${projectId}/boq/estimate-import/validate`,
    { method: 'POST', body: JSON.stringify({ file: base64 }) },
  );
  return importReportSchema.parse(raw);
}

export async function confirmEstimateImport(
  projectId: string,
  batchId: string,
): Promise<{ groups: number; lines: number; quotedPercentageSet: boolean }> {
  return authFetch(`/projects/${projectId}/boq/estimate-import/confirm`, {
    method: 'POST',
    body: JSON.stringify({ batchId }),
  });
}

export async function confirmBOQImport(
  projectId: string,
  batchId: string,
): Promise<{ groups: number; lines: number; quotedPercentageSet: boolean }> {
  return authFetch<{ groups: number; lines: number; quotedPercentageSet: boolean }>(
    `/projects/${projectId}/boq/import/confirm`,
    { method: 'POST', body: JSON.stringify({ batchId }) },
  );
}

/** The data portion only — the API decodes bytes, not a data URL. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}
