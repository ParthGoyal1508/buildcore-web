# Quickstart: Validating the Account Creation Frontend

## Prerequisites

- `buildcore-api`'s `010-account-creation-backend` running and reachable; a seeded company, roles
  (including Super Admin), and at least one unlinked employee. Logged in as a Super Admin/HO User
  for Scenario 1.

## Scenario 1 — Create a user (US1)

1. Navigate to `/dashboard/settings/users`, click "Add User". **Expected**: navigates to
   `/dashboard/account-creation/new`.
2. Fill Email, Role (a non-Super-Admin role), Company, toggle to "Link an employee", pick an
   unlinked employee. Submit. **Expected**: redirected to `/dashboard/settings/users`, a toast
   confirms the invite was sent, and the new row appears with status "pending".
3. Repeat with Role = Super Admin. **Expected**: the Company field is hidden before submit.
4. Submit again with the same email from step 2. **Expected**: a 409 message is shown inline,
   distinguishing "already active" from "exists but deactivated."
5. As a non-Super-Admin/HO-User, navigate directly to `/dashboard/account-creation/new`.
   **Expected**: access-denied state, matching the Users screen's own guard.

## Scenario 2 — Set password (US2)

1. From a test-captured invite email (or a directly-seeded token), navigate to
   `/set-password/:token`. **Expected**: the invitee's email shown read-only, password form
   visible.
2. Type a weak password (e.g. "abc"). **Expected**: live complexity feedback shows which rules
   aren't met, before any submit attempt.
3. Type a valid password and submit. **Expected**: brief success state, then redirect to
   `/login?activated=1` showing "Account activated — log in with your new password."
4. Log in with the new password. **Expected**: succeeds normally.
5. Reuse the same `/set-password/:token` URL. **Expected**: "This invite link is no longer valid"
   (reason: consumed) — no form shown.
6. Navigate to any `/set-password/:token` URL while already logged in (existing session cookie).
   **Expected**: renders normally, no redirect away.
