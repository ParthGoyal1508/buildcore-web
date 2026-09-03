import { z } from 'zod';

import {
  CLIENT_STATUSES,
  PROJECT_DIVISIONS,
  PROJECT_SITE_TYPES,
  PROJECT_STATUSES,
  SITE_STATUSES,
} from '@/app/lib/constants';
import { authFetch } from '@/app/lib/session';

/**
 * Every `/dashboard/projects/*` call to `buildcore-api` (feature 008).
 *
 * One module per domain, per Constitution Principle V — no component issues its own
 * `fetch()`. Every response is parsed through a `zod` schema before the app trusts
 * it (Principle IV), and the `z.infer` type is what the UI consumes.
 *
 * Scoped to User Stories 1–3. BOQ, DWR, revenue, billing, budget, P&L and documents
 * are in `contracts/projects-web-api.md` but have no functions here, because the
 * endpoints they would call do not exist yet — a typed stub against an absent
 * endpoint is a compile-time promise the runtime cannot keep.
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
  description: z.string().nullable(),
});
export type Project = z.infer<typeof projectSchema>;

export interface ProjectQuery {
  search?: string;
  status?: string;
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export async function getProjects(
  query: ProjectQuery = {},
): Promise<ProjectPage> {
  const raw = await authFetch<unknown>(`/projects${qs({ ...query })}`);
  return projectPageSchema.parse(raw);
}

export async function getProject(id: string): Promise<Project> {
  // The endpoint returns `{ project, tabs, unavailableModules }`. Only `project` is
  // read here: the tabs belong to the detail page, which is User Story 4 and not
  // built — parsing data no screen renders would be a schema to maintain for
  // nothing, and one more thing to go stale before it is ever used.
  const raw = await authFetch<{ project: unknown }>(`/projects/${id}`);
  return projectSchema.parse(raw.project);
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
  description?: string;
  isLocked?: boolean;
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
