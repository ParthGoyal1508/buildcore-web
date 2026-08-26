# Quickstart: Validating the Login Feature

## Prerequisites

- `buildcore-api` running locally with the `/auth/login`, `/auth/refresh-token`, and `/auth/logout`
  endpoints matching [contracts/auth-api.md](contracts/auth-api.md) (see research.md §1 — this is
  new/changed backend behavior, not the current starter behavior).
- `buildcore-web`: `npm install && npm run dev` (serves on port 3001 per `package.json`).
- `NEXT_PUBLIC_API_URL` in `.env.local` pointing at the local `buildcore-api` instance.
- At least one seeded test account: one active account with a known password, and (for lockout
  testing) the ability to trigger 5 failed attempts without affecting other test data.

## Scenario 1 — Successful login (User Story 1, P1)

1. Visit `/login`.
2. Enter the seeded account's correct email/password; toggle the password visibility control at
   least once to confirm it reveals/hides the typed value without clearing it.
3. Submit.
4. **Expected**: redirected to `/dashboard`; a "Welcome back, {name}!" confirmation is shown.

## Scenario 2 — Invalid credentials, no enumeration (User Story 2, P1)

1. Submit the login form with the Email or Password field empty.
   **Expected**: inline error(s) next to the empty field(s); no network request sent.
2. Submit a well-formed but unregistered email with any password.
   **Expected**: "Invalid email or password."
3. Submit the seeded account's real email with a wrong password.
   **Expected**: identical "Invalid email or password" message as step 2 — compare byte-for-byte.

## Scenario 3 — Remember Me persistence (User Story 3, P2)

1. Log in with "Remember Me" checked.
2. Fully close and reopen the browser (not just the tab).
   **Expected**: still signed in, no re-login required.
3. Repeat with "Remember Me" unchecked.
   **Expected**: signed out after a full browser restart.
4. While signed in, have an admin (or a direct test fixture) deactivate the same account.
   **Expected**: the next in-app action fails and the user is returned to `/login`.

## Scenario 4 — Logout (User Story 4, P2)

1. Log in, then use the "Sign Out" control (existing `app/ui/dashboard/sidenav.tsx`).
2. **Expected**: redirected to `/login`; attempting to reuse the prior session (e.g., replaying
   the old access token, or hitting `/dashboard` directly) fails and does not grant access.

## Scenario 5 — Brute-force lockout (User Story 5, P2)

1. Submit 5 consecutive wrong passwords for one seeded account.
2. **Expected after the 5th failure**: account is locked; a lockout notification email is sent
   (check the test email sink/log).
3. Attempt a 6th login with the *correct* password while still locked.
   **Expected**: rejected with the distinct lockout message (not the generic invalid-credentials
   message), stating the account is temporarily locked and roughly when it unlocks.
4. Wait for (or fast-forward, in a test environment) the 15-minute window to elapse, then log in
   with the correct password.
   **Expected**: succeeds normally; a subsequent single wrong-password attempt starts the failure
   count over at 1, not 6.

## Cross-cutting checks

- Every attempt in Scenarios 2, 4, and 5 (success, failure, lockout, logout) should produce a
  corresponding Activity Log entry with the correct actor, timestamp, and IP (FR-017) — spot-check
  via whatever admin/Activity Log view or direct data check `buildcore-api` exposes.
- Confirm no request/response in the browser's network tab ever contains a plaintext password
  outside the initial login POST body over TLS, and that dev-tools console/application storage
  shows no refresh token accessible to JavaScript (`document.cookie` should not list it — it must
  be `HttpOnly`).
