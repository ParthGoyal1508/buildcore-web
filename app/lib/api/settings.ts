import { z } from 'zod';
import { ApiError } from '@/app/lib/api/client';
import { authFetch, authFetchBlob } from '@/app/lib/session';

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
  // Printed at the head of a work order or purchase order (2026-10-14). Optional in the schema so
  // a server that predates them still parses.
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
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
  /** 041: how many branches (GST registrations) the company has; only the list carries it. */
  branchCount: z.number().optional(),
  /**
   * The worst GPS accuracy a punch may report and still be located, in metres (020 FR-012b,
   * surfaced 042). Null is "no decision": the company follows the product default, which only
   * the API knows — see `setPunchAccuracy`. Optional because the DTO does not declare it; it
   * reaches the wire through `CompanyResponseDto.fromEntity`'s spread of the row.
   */
  punchAccuracyMaxMetres: z.number().nullable().optional(),
  /** Whether a punch that fails location or face validation is refused outright (020 FR-013)
   * rather than recorded as an exception. Optional for the same reason as above. */
  punchBlockEnforced: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Company = z.infer<typeof companySchema>;
export type CompanyInput = Partial<
  Omit<Company, 'id' | 'createdAt' | 'updatedAt'>
>;

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

/**
 * Uploads the company's logo (2026-10-13) — shown in the sidebar and printed at the head of every
 * payment advice the company issues. The server detects the type from the bytes and refuses
 * anything that is not an image.
 */
export async function uploadCompanyLogo(id: string, file: File): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1)
    binary += String.fromCharCode(bytes[i]);
  await authFetch(`/settings/companies/${id}/logo`, {
    method: 'PUT',
    body: JSON.stringify({ data: btoa(binary) }),
  });
}

/**
 * Uploads the company's printed letterhead (042) — a **full-page** image (header, blank middle,
 * footer), exactly as the pre-printed stationery is. The letter renderer draws it to the page
 * edges behind every letter and lays the body in the clear band. Same transport as the logo
 * above: base64 in a JSON body, type detected from the bytes server-side, anything that is not
 * an image refused with a 400.
 *
 * Replacing it changes every letter issued **from now on**; letters already issued keep their
 * own rendered PDF and are unaffected.
 */
export async function uploadCompanyLetterhead(
  id: string,
  file: File,
): Promise<{ contentType: string; sizeBytes: number }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1)
    binary += String.fromCharCode(bytes[i]);
  return z
    .object({ contentType: z.string(), sizeBytes: z.number() })
    .parse(
      await authFetch(`/settings/companies/${id}/letterhead`, {
        method: 'PUT',
        body: JSON.stringify({ data: btoa(binary) }),
      }),
    );
}

/**
 * The letterhead currently in force, as the image itself — what letters will print on.
 *
 * `null` when the company has none, which the API reports as a 404 and is a legitimate state,
 * not an error: those companies' letters render on plain paper.
 */
export async function getCompanyLetterhead(id: string): Promise<Blob | null> {
  try {
    return await authFetchBlob(`/settings/companies/${id}/letterhead`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Sets the acceptable GPS accuracy for a punch, in metres (020 FR-012b, surfaced 042).
 *
 * `null` clears the company's decision and returns it to the product default — a different act
 * from setting it to the default's current value: a cleared company follows the default if it
 * ever changes. The response's `effective` is the number punches will actually be judged by,
 * which is the only way the client learns the default without restating it.
 */
export async function setPunchAccuracy(
  companyId: string,
  metres: number | null,
): Promise<{ punchAccuracyMaxMetres: number | null; effective: number }> {
  return z
    .object({
      punchAccuracyMaxMetres: z.number().nullable(),
      effective: z.number(),
    })
    .parse(
      await authFetch(`/settings/companies/${companyId}/punch-accuracy`, {
        method: 'PUT',
        body: JSON.stringify({ punchAccuracyMaxMetres: metres }),
      }),
    );
}

/**
 * Switches the hard punch refusal on or off (020 FR-013, surfaced 042).
 *
 * While off — the default — a failing punch is recorded as an exception for an admin and the
 * would-be refusal logged; while on it is refused outright and nothing is written to attendance.
 * Takes effect on the next punch. The refusal log (`/hr/attendance/refusals`) keeps the same
 * shape either way, so before and after are directly comparable.
 */
export async function setPunchEnforcement(
  companyId: string,
  enforced: boolean,
): Promise<{ punchBlockEnforced: boolean }> {
  return z
    .object({ punchBlockEnforced: z.boolean() })
    .parse(
      await authFetch(`/settings/companies/${companyId}/punch-enforcement`, {
        method: 'PUT',
        body: JSON.stringify({ punchBlockEnforced: enforced }),
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

export async function getCodeSeries(
  companyId: string,
): Promise<CodeSeriesView> {
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
  /** New accounts get this role when the creator names none (029 FR-001). Defaulted so a
   * server predating the field still parses. */
  isDefault: z.boolean().default(false),
  /** Where holders land after signing in — a module key (029 FR-020). Null: their first module. */
  homeModule: z.string().nullable().default(null),
  assignedUserCount: z.number(),
  /** Active accounts holding the role in the caller's company (036 C11). Optional: a server
   * predating it still parses, and the screens then say nothing rather than "0 holders". */
  activeHolderCount: z.number().optional(),
  /**
   * The company a custom role belongs to; null for a system role every company shares (036 C10).
   * Defaulted so a server predating the field still parses — every role was global then.
   */
  companyId: z.string().nullable().default(null),
  /** That company's name, on the list only. */
  companyName: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Role = z.infer<typeof roleSchema>;

/** Whether an account of `companyId` may hold the role: a global one, or its own company's. */
export function roleFitsCompany(
  role: Pick<Role, 'companyId'>,
  companyId: string | null | undefined,
): boolean {
  return role.companyId === null || role.companyId === (companyId ?? null);
}

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
  homeModule?: string | null;
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
  input: {
    name?: string;
    permissions?: string[];
    grants?: RoleGrant[];
    homeModule?: string | null;
  },
): Promise<Role> {
  return roleSchema.parse(
    await authFetch(`/settings/roles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteRole(
  id: string,
): Promise<{ clearedAssignments: number }> {
  return z
    .object({ clearedAssignments: z.number() })
    .parse(await authFetch(`/settings/roles/${id}`, { method: 'DELETE' }));
}

// -------------------------------------------------------------------- Users

/**
 * `roles` is an array, not a single `role`: an account can hold several roles at
 * once and its effective permissions are their union. Since 036 C1 the Users form edits the
 * whole set (`roleIds`); it used to edit `roles[0]` alone, and saving removed the others.
 */
export const userSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  username: z.string().nullable(),
  roles: z.array(z.object({ id: z.string(), name: z.string() })),
  /** `pending`: invited, has not set a password yet (010). Missing from this enum until 029,
   * which made the whole list fail to parse the moment anyone was invited. */
  status: z.enum(['pending', 'active', 'deactivated']),
  companyId: z.string().nullable(),
  lastLoginAt: z.string().nullable(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;

export async function listUsers(): Promise<UserSummary[]> {
  return z.array(userSummarySchema).parse(await authFetch('/settings/users'));
}

export interface UserListParams {
  q?: string;
  status?: UserSummary['status'] | '';
  roleId?: string;
  companyId?: string;
  /** `key:asc` / `key:desc` — name, email, status, lastLoginAt, createdAt. */
  sort?: string;
  page: number;
  pageSize: number;
}

const userPageSchema = z.object({
  items: z.array(userSummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type UserPage = z.infer<typeof userPageSchema>;

/** One page of accounts, searched and filtered on the server (036 C5). */
export async function listUsersPage(params: UserListParams): Promise<UserPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return userPageSchema.parse(
    await authFetch(`/settings/users?${query.toString()}`),
  );
}

export async function updateUser(
  id: string,
  input: {
    /** The account's whole role set after the save — at least one (036 C1, C2). */
    roleIds?: string[];
    status?: 'active' | 'deactivated';
  },
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
  return companyId
    ? `${path}?companyId=${encodeURIComponent(companyId)}`
    : path;
}

function namedReferenceApi(resource: 'departments' | 'designations') {
  return {
    list: async (companyId?: string): Promise<NamedReference[]> =>
      z
        .array(namedReferenceSchema)
        .parse(
          await authFetch(withCompany(`/settings/${resource}`, companyId)),
        ),
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
    update: async (
      id: string,
      input: { name: string },
    ): Promise<NamedReference> =>
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

export async function updateShift(
  id: string,
  input: ShiftInput,
): Promise<Shift> {
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
 * Whether cash transactions are hidden for this company.
 *
 * Since 038 hiding means cash does not exist: while it is on the API leaves every cash record out
 * of every read and total, and refuses every cash write (`CASH_HIDDEN`) for everyone. Nothing is
 * deleted, and turning it off restores everything exactly. Forms learn it from `/my/cash-policy`
 * (`useCashPolicy`), which any signed-in user may read; this endpoint stays the Super Admin's.
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

/**
 * Changes it. Super Admin only, and only with a live password confirmation from
 * `confirmPassword('cash-visibility')` (2026-10-14) — the API refuses the change without one
 * with a 403 coded `PASSWORD_CONFIRMATION_REQUIRED`, never a 401, so a lapsed confirmation
 * asks for the password again instead of signing anybody out.
 */
export async function setCashVisibility(
  hideCashTransactions: boolean,
  confirmationToken: string,
  companyId?: string,
): Promise<CashVisibility> {
  return cashVisibilitySchema.parse(
    await authFetch(withCompany('/settings/cash-visibility', companyId), {
      method: 'PATCH',
      headers: { 'X-Confirmation-Token': confirmationToken },
      body: JSON.stringify({ hideCashTransactions }),
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Numbering (2026-10-15)
// ─────────────────────────────────────────────────────────────────────────────

/** One series as Settings → Numbering shows it. */
export const numberingEntrySchema = z.object({
  series: z.enum([
    'PROJECTS',
    'VENDORS',
    'WORK_ORDER',
    // Plant and store documents (2026-10-15).
    'JOB_CARD',
    'ISSUE_SLIP',
    'DELIVERY_CHALLAN',
    'STOCK_TRANSFER',
    'EQUIPMENT',
    'ASSETS',
  ]),
  label: z.string(),
  /** `counted`: prefix + (start + n × gap). `named`: letters from the name, serial, year. */
  kind: z.enum(['counted', 'named']),
  prefix: z.string(),
  base: z.number(),
  step: z.number(),
  width: z.number(),
  separator: z.string(),
  isDefault: z.boolean(),
  examples: z.array(z.string()),
  /** The code the next record will actually get — counted series only. */
  nextCode: z.string().nullable(),
});
export type NumberingEntry = z.infer<typeof numberingEntrySchema>;

export async function getNumbering(
  companyId: string,
): Promise<NumberingEntry[]> {
  return z
    .array(numberingEntrySchema)
    .parse(await authFetch(`/settings/companies/${companyId}/numbering`));
}

export async function setNumbering(
  companyId: string,
  series: NumberingEntry['series'],
  input: Partial<
    Pick<NumberingEntry, 'prefix' | 'base' | 'step' | 'width' | 'separator'>
  >,
): Promise<NumberingEntry> {
  return numberingEntrySchema.parse(
    await authFetch(`/settings/companies/${companyId}/numbering/${series}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  );
}

/** Back to the built-in format (Parth Realcon's). */
export async function resetNumbering(
  companyId: string,
  series: NumberingEntry['series'],
): Promise<NumberingEntry> {
  return numberingEntrySchema.parse(
    await authFetch(`/settings/companies/${companyId}/numbering/${series}`, {
      method: 'DELETE',
    }),
  );
}
