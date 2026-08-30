import { z } from 'zod';
import { authFetch } from '@/app/lib/session';

/**
 * Every Settings response is parsed through a zod schema before it reaches a
 * component (Constitution Principle IV). The backend is trusted, but a shape change
 * on its side should fail loudly here rather than surface as `undefined` three
 * components deep.
 */

// ---------------------------------------------------------------- Companies

export const companySchema = z.object({
  id: z.string(),
  name: z.string(),
  shortCode: z.string(),
  logoUrl: z.string().nullable(),
  status: z.enum(['active', 'inactive']),
  gstin: z.string().nullable(),
  pan: z.string().nullable(),
  cin: z.string().nullable(),
  tan: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pinCode: z.string().nullable(),
  pfEstablishmentCode: z.string().nullable(),
  esicCode: z.string().nullable(),
  professionalTaxRegNumber: z.string().nullable(),
  bocwRegNumber: z.string().nullable(),
  payCycle: z.enum(['monthly']),
  payrollLockDay: z.number(),
  pfEmployerRate: z.number(),
  esicEmployerRate: z.number(),
  gratuityRate: z.number(),
  bonusRate: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Company = z.infer<typeof companySchema>;
export type CompanyInput = Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>;

export async function listCompanies(): Promise<Company[]> {
  return z.array(companySchema).parse(await authFetch('/settings/companies'));
}

/** Active companies only — what every company-selector elsewhere should show
 * (spec FR-005). Deactivated companies stay in the admin list above. */
export async function listActiveCompanies(): Promise<Company[]> {
  return (await listCompanies()).filter((c) => c.status === 'active');
}

export async function createCompany(input: CompanyInput): Promise<Company> {
  return companySchema.parse(
    await authFetch('/settings/companies', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateCompany(
  id: string,
  input: CompanyInput,
): Promise<Company> {
  return companySchema.parse(
    await authFetch(`/settings/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

// -------------------------------------------------------------- Code series

export const codeSeriesSchema = z.object({
  companyId: z.string(),
  shortCode: z.string(),
  lastNumber: z.number(),
  nextCode: z.string(),
});
export type CodeSeriesView = z.infer<typeof codeSeriesSchema>;

export async function getCodeSeries(companyId: string): Promise<CodeSeriesView> {
  return codeSeriesSchema.parse(
    await authFetch(`/settings/companies/${companyId}/code-series`),
  );
}

// -------------------------------------------------------------------- Roles

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  permissions: z.array(z.string()),
  isProtected: z.boolean(),
  assignedUserCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Role = z.infer<typeof roleSchema>;

export async function listRoles(): Promise<Role[]> {
  return z.array(roleSchema).parse(await authFetch('/settings/roles'));
}

export async function createRole(input: {
  name: string;
  permissions: string[];
}): Promise<Role> {
  return roleSchema.parse(
    await authFetch('/settings/roles', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateRole(
  id: string,
  input: { name?: string; permissions?: string[] },
): Promise<Role> {
  return roleSchema.parse(
    await authFetch(`/settings/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteRole(id: string): Promise<{ clearedAssignments: number }> {
  return z
    .object({ clearedAssignments: z.number() })
    .parse(await authFetch(`/settings/roles/${id}`, { method: 'DELETE' }));
}

// -------------------------------------------------------------------- Users

/**
 * `roles` is an array, not a single `role`: an account can hold several roles at
 * once and its effective permissions are their union. The Users form still edits a
 * single role, which replaces the whole set — that is what the API's `roleId` means.
 */
export const userSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  username: z.string(),
  roles: z.array(z.object({ id: z.string(), name: z.string() })),
  status: z.enum(['active', 'deactivated']),
  companyId: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export async function listUsers(): Promise<UserSummary[]> {
  return z.array(userSummarySchema).parse(await authFetch('/settings/users'));
}

export async function updateUser(
  id: string,
  input: { roleId?: string; status?: 'active' | 'deactivated' },
): Promise<UserSummary> {
  return userSummarySchema.parse(
    await authFetch(`/settings/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteUser(id: string): Promise<void> {
  await authFetch(`/settings/users/${id}`, { method: 'DELETE' });
}

// --------------------------------------------- Departments and Designations

const namedReferenceSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NamedReference = z.infer<typeof namedReferenceSchema>;

/** `companyId` is honoured only for a cross-company caller; for everyone else the
 * API pins the result to their own company regardless of what is sent. */
function withCompany(path: string, companyId?: string): string {
  return companyId ? `${path}?companyId=${encodeURIComponent(companyId)}` : path;
}

function namedReferenceApi(resource: 'departments' | 'designations') {
  return {
    list: async (companyId?: string): Promise<NamedReference[]> =>
      z
        .array(namedReferenceSchema)
        .parse(await authFetch(withCompany(`/settings/${resource}`, companyId))),
    create: async (input: {
      companyId?: string;
      name: string;
    }): Promise<NamedReference> =>
      namedReferenceSchema.parse(
        await authFetch(`/settings/${resource}`, {
          method: 'POST',
          body: JSON.stringify(input),
        }),
      ),
    update: async (id: string, input: { name: string }): Promise<NamedReference> =>
      namedReferenceSchema.parse(
        await authFetch(`/settings/${resource}/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        }),
      ),
    remove: async (id: string): Promise<void> => {
      await authFetch(`/settings/${resource}/${id}`, { method: 'DELETE' });
    },
  };
}

const departments = namedReferenceApi('departments');
const designations = namedReferenceApi('designations');

export const listDepartments = departments.list;
export const createDepartment = departments.create;
export const updateDepartment = departments.update;
export const deleteDepartment = departments.remove;

export const listDesignations = designations.list;
export const createDesignation = designations.create;
export const updateDesignation = designations.update;
export const deleteDesignation = designations.remove;

// ----------------------------------------------------------- Document types

export const documentTypeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  isMandatory: z.boolean(),
  hasExpiry: z.boolean(),
  needsNumber: z.boolean(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  /** Computed server-side on every read; never sent on a write. */
  flag: z.enum([
    'MandatoryNumber',
    'Mandatory',
    'ExpiryNumber',
    'Expiry',
    'Number',
    'Optional',
  ]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DocumentType = z.infer<typeof documentTypeSchema>;

export interface DocumentTypeInput {
  companyId?: string;
  code?: string;
  name?: string;
  isMandatory?: boolean;
  hasExpiry?: boolean;
  needsNumber?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export async function listDocumentTypes(
  companyId?: string,
): Promise<DocumentType[]> {
  return z
    .array(documentTypeSchema)
    .parse(await authFetch(withCompany('/settings/document-types', companyId)));
}

export async function createDocumentType(
  input: DocumentTypeInput,
): Promise<DocumentType> {
  return documentTypeSchema.parse(
    await authFetch('/settings/document-types', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

/** There is no delete: a document type is retired with `isActive: false` so the
 * employee records referencing it stay intact (spec FR-016). */
export async function updateDocumentType(
  id: string,
  input: DocumentTypeInput,
): Promise<DocumentType> {
  return documentTypeSchema.parse(
    await authFetch(`/settings/document-types/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

// ------------------------------------------------------------------- Shifts

export const shiftSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  /** `HH:mm`, a wall-clock time of day with no date or zone. */
  inTime: z.string(),
  outTime: z.string(),
  graceMinutes: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Shift = z.infer<typeof shiftSchema>;

export interface ShiftInput {
  companyId?: string;
  name?: string;
  inTime?: string;
  outTime?: string;
  graceMinutes?: number;
}

export async function listShifts(companyId?: string): Promise<Shift[]> {
  return z
    .array(shiftSchema)
    .parse(await authFetch(withCompany('/settings/shifts', companyId)));
}

export async function createShift(input: ShiftInput): Promise<Shift> {
  return shiftSchema.parse(
    await authFetch('/settings/shifts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function updateShift(id: string, input: ShiftInput): Promise<Shift> {
  return shiftSchema.parse(
    await authFetch(`/settings/shifts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteShift(id: string): Promise<void> {
  await authFetch(`/settings/shifts/${id}`, { method: 'DELETE' });
}
