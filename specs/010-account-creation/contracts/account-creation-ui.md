# Contract: Account Creation Frontend

## `/dashboard/account-creation/new` (User Story 1)

**Page**: `app/dashboard/account-creation/new/page.tsx` + `app/ui/account-creation/CreateUserForm.tsx`.

**Functions** (in `app/lib/api/account-creation.ts`):
- `getUnlinkedEmployees(companyId, search?): Promise<UnlinkedEmployee[]>` →
  `GET /account-creation/employees/unlinked?companyId=&search=`
- `createUser(data: CreateUserFormValues): Promise<CreateUserResponse>` →
  `POST /account-creation/users` (companyId omitted from the body when role is Super Admin)

**Guard**: `middleware.ts` requires `USER_MANAGEMENT` AND caller's role is Super Admin/HO User —
identical guard to `002-settings`'s `/dashboard/settings/users` (spec FR-001, FR-002 there).

On success: toast + `router.push('/dashboard/settings/users')` + invalidate that screen's
`['settings', 'users']` query key (research.md §5).

---

## `/set-password/:token` (User Story 2, public — no middleware guard)

**Page**: `app/set-password/[token]/page.tsx` + `app/ui/account-creation/SetPasswordForm.tsx`.

**Functions**:
- `validateInvite(token): Promise<InviteValidationResponse>` →
  `GET /account-creation/invites/:token`
- `setPassword(token, password): Promise<{ success: true }>` →
  `POST /account-creation/invites/:token/set-password`

On success: redirect to `/login?activated=1`; 001's login page reads that query param to show an
"Account activated" banner (a one-line addition to `001-user-login`'s login page — see that
feature's own tasks if not already present; not a new feature of its own).

---

## Cross-feature contract updates

`002-settings`'s `contracts/settings-ui.md` "Add User" control is updated from "a plain `<Link>` to
the separate Account Creation route (no function call here — out of this feature's scope)" to name
this concrete path: `<Link href="/dashboard/account-creation/new">`.
