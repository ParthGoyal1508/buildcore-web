# Contract: Settings UI routes and `app/lib/api/settings.ts`

Routes live under the existing `DashboardLayout` shell (research.md §1). Every function below is a
typed wrapper in `app/lib/api/settings.ts` calling the corresponding `buildcore-api` endpoint in
`specs/002-settings-backend/contracts/settings-api.md` (that document is the wire-level authority;
this one describes what each screen calls and renders).

## `/dashboard/settings/companies` (User Story 1)

**Page**: `app/dashboard/settings/companies/page.tsx` (Server Component — initial list fetch) +
`app/ui/settings/company-list.tsx` (Client Component — react-query-backed table/card list) +
`app/ui/settings/company-modal.tsx` (Client Component — five-tab form, research.md §5).

**Functions**:
- `listCompanies(): Promise<Company[]>` → `GET /settings/companies`
- `createCompany(input: CreateCompanyInput): Promise<Company>` → `POST /settings/companies`
- `updateCompany(id: string, input: Partial<CreateCompanyInput>): Promise<Company>` →
  `PATCH /settings/companies/:id`

Guard: middleware requires `COMPANY_SETTINGS` (research.md §2); otherwise renders
`app/ui/access-denied.tsx`.

## `/dashboard/settings/roles` (User Story 2)

**Page**: `app/dashboard/settings/roles/page.tsx` + `app/ui/settings/role-list.tsx` +
`app/ui/settings/role-modal.tsx` (permission multi-select from `PERMISSIONS` constant,
research.md §4).

**Functions**:
- `listRoles(): Promise<Role[]>` → `GET /settings/roles`
- `createRole(input: { name: string; permissions: Permission[] }): Promise<Role>` →
  `POST /settings/roles`
- `updateRole(id, input): Promise<Role>` → `PATCH /settings/roles/:id` — the modal disables
  submission entirely when `role.isProtected` is true (Super Admin), matching the backend's own
  403 rather than relying on the request never being sent.
- `deleteRole(id): Promise<void>` → `DELETE /settings/roles/:id` — confirmation dialog warns about
  cascading role-clear on affected users (spec FR-009) before calling this.

Guard: middleware requires `USER_MANAGEMENT`.

## `/dashboard/settings/users` (User Story 3)

**Page**: `app/dashboard/settings/users/page.tsx` + `app/ui/settings/user-list.tsx`.

**Functions**:
- `listUsers(): Promise<UserSummary[]>` → `GET /settings/users`
- `updateUser(id, input: { roleId?: string; status?: 'active' | 'inactive' }): Promise<UserSummary>`
  → `PATCH /settings/users/:id` — a 409 response (last-active-Super-Admin protection, backend
  FR-016) is surfaced verbatim as the form's error message (spec FR-013).
- `deleteUser(id): Promise<void>` → `DELETE /settings/users/:id` — same 409 handling.

The "Add User" control (spec FR-011) is a plain `<Link href="/dashboard/account-creation/new">`
(`010-account-creation`) — no function call here, out of this feature's scope.

Guard: middleware requires `USER_MANAGEMENT` AND the caller's own role is Super Admin or HO User
(spec FR-010) — any other authenticated role gets `AccessDenied`, not a read-only render.

## `/dashboard/settings/employee-setup` (User Stories 4–7)

**Page**: `app/dashboard/settings/employee-setup/page.tsx`, wrapped in the local `CompanyContext`
(research.md §6), with five tab components: `department-tab.tsx`, `designation-tab.tsx`,
`document-type-tab.tsx`, `shift-tab.tsx`, `code-series-tab.tsx`.

**Functions** (all take the current `CompanyContext` company id):
- `listDepartments(companyId)`, `createDepartment(companyId, { name })`,
  `updateDepartment(id, { name })`, `deleteDepartment(id)` → `/settings/departments*`
- `listDesignations(companyId)`, `createDesignation`, `updateDesignation`, `deleteDesignation` →
  `/settings/designations*`
- `listDocumentTypes(companyId)`, `createDocumentType`, `updateDocumentType` →
  `/settings/document-types*` (no delete function — `isActive` toggle only, matching the backend's
  own omission of `DELETE` for this resource)
- `listShifts(companyId)`, `createShift`, `updateShift`, `deleteShift` → `/settings/shifts*`
- `getCodeSeries(companyId): Promise<CodeSeriesView>` → `GET /settings/companies/:id/code-series`
  (read-only; no corresponding mutation function exists)

Every create/update function for Department/Designation/Shift surfaces a 409 (duplicate name, or
still-referenced-on-delete) as an inline field/dialog error rather than a generic failure (spec
FR-022). `document-type-tab.tsx` recomputes `derivedFlag` locally (data-model.md) for the live
preview described in spec FR-016, before the save round-trip confirms the same value.

Guard: middleware requires `EMPLOYEES`.

## Shared: `app/ui/access-denied.tsx`

A single reusable component rendered by middleware (research.md §2) in place of any
`/dashboard/settings/*` page when the caller lacks the route's required permission — satisfies spec
FR-020/SC-006 with one implementation instead of a per-page check.
