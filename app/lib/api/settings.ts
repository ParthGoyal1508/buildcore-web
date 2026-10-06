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
  /**
   * The account the payroll transfer is debited from (021 FR-008a).
   *
   * A **string**: an account number's leading zero is part of it, and the client's own sample debits
   * `09310400000819`. Parsing it as a number would destroy the zero before any screen saw it.
   *
   * `.nullable().default(null)` so a company saved before the field existed still parses.
   */
  payrollDebitAccountNumber: z.string().nullable().default(null),
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

/**
 * The four statutory rates a running-account bill is computed at (025 FR-021).
 *
 * **Fractions on the wire** — `"0.090000"` is nine per cent — because that is what the bill freezes
 * and compares against the client's signed paper. The screen multiplies by 100 to show them and
 * divides to send them, which is the same conversion the project's retention term makes and for the
 * same reason: one unit in the database, the contract's own unit on the screen.
 */
export const billingRatesSchema = z.object({
  cgstFraction: z.string(),
  sgstFraction: z.string(),
  igstFraction: z.string(),
  tdsFraction: z.string(),
});

export type BillingRates = z.infer<typeof billingRatesSchema>;

export async function getBillingRates(
  companyId: string,
): Promise<BillingRates> {
  return billingRatesSchema.parse(
    await authFetch(`/settings/companies/${companyId}/billing-rates`),
  );
}

/** Each rate optional: naming one leaves the other three alone. */
export async function setBillingRates(
  companyId: string,
  input: Partial<Record<keyof BillingRates, number>>,
): Promise<BillingRates> {
  return billingRatesSchema.parse(
    await authFetch(`/settings/companies/${companyId}/billing-rates`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

export async function getCodeSeries(companyId: string): Promise<CodeSeriesView> {
  return codeSeriesSchema.parse(
    await authFetch(`/settings/companies/${companyId}/code-series`),
  );
}

// -------------------------------------------------------------------- Roles

/** The two levels an area can be held at. Write implies read; the backend refuses write alone. */
export const ACCESS_LEVELS = ['read', 'write'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const roleGrantSchema = z.object({
  permission: z.string(),
  level: z.enum(ACCESS_LEVELS),
});
export type RoleGrant = z.infer<typeof roleGrantSchema>;

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  permissions: z.array(z.string()),
  /**
   * What level each area is held at (019 FR-019).
   *
   * **This was being discarded.** The server sends it, the guard enforces it, and this schema
   * dropped it on the floor — so the editor had nothing to render, sent `permissions` alone, and
   * every role it saved came back holding read **and** write on everything. That is the sixth time
   * in this codebase a server field has been silently lost to a schema, and the first where the
   * loss was a security-relevant default rather than a missing label.
   *
   * `.default([])` so a server predating the field still parses: an empty list means "no levels
   * named", which is exactly what the backend treats as read+write.
   */
  grants: z.array(roleGrantSchema).default([]),
  isProtected: z.boolean(),
  assignedUserCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Role = z.infer<typeof roleSchema>;

export async function listRoles(): Promise<Role[]> {
  return z.array(roleSchema).parse(await authFetch('/settings/roles'));
}

/**
 * Creating or editing a role (019 FR-018).
 *
 * `grants` is optional on the wire and means something specific when omitted: **read and write on
 * everything in `permissions`**, which is what holding a permission meant before levels existed and
 * what the Phase 1 backfill gave every role. Sending it is how anything narrower is expressed, so
 * the editor always sends it — omitting it quietly widens a role that was read-only.
 */
export async function createRole(input: {
  name: string;
  permissions: string[];
  grants?: RoleGrant[];
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
  input: { name?: string; permissions?: string[]; grants?: RoleGrant[] },
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

// ─────────────────────────────────────────────────────────────────────────────
// Cash visibility (019 FR-012 to FR-015 — `bugs.md` item 16)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether cash amounts are hidden for this company.
 *
 * A **display** control, which is the whole of its design: nothing is deleted or altered while it
 * is on, and turning it off restores every figure exactly. The API nulls a cash amount and sets
 * `amountHidden` beside it rather than zeroing it — see `app/lib/api/cash-hiding.ts` for why that
 * distinction has to survive all the way to the screen.
 */
export const cashVisibilitySchema = z.object({
  hideCashTransactions: z.boolean(),
});
export type CashVisibility = z.infer<typeof cashVisibilitySchema>;

export async function getCashVisibility(
  companyId?: string,
): Promise<CashVisibility> {
  return cashVisibilitySchema.parse(
    await authFetch(withCompany('/settings/cash-visibility', companyId)),
  );
}

export async function setCashVisibility(
  hideCashTransactions: boolean,
  companyId?: string,
): Promise<CashVisibility> {
  return cashVisibilitySchema.parse(
    await authFetch(withCompany('/settings/cash-visibility', companyId), {
      method: 'PATCH',
      body: JSON.stringify({ hideCashTransactions }),
    }),
  );
}
