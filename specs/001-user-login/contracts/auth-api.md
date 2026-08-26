# Contract: Auth endpoints consumed by the Login feature

Served by `buildcore-api` (separate repository). `buildcore-web` consumes these exclusively
through `app/lib/api/auth.ts`, per Constitution Principle V. This document describes the target
contract this feature needs — it revises `buildcore-api`'s current bare-starter behavior
(see research.md §1) and is the reference for both the frontend tasks and the backend tasks.

## `POST /auth/login`

**Request body**:
```json
{ "email": "string", "password": "string", "rememberMe": "boolean" }
```

**Response — 200 OK** (credentials valid, account active, not locked):
```json
{ "accessToken": "string", "name": "string", "mustChangePassword": "boolean" }
```
- Sets the refresh token as a `Secure; HttpOnly; SameSite=Strict` cookie on the response.
  `Max-Age` is 30 days if `rememberMe` was true, otherwise a short session-length default.
- `name` is used for the "Welcome back, {name}!" message (FR-006).
- `mustChangePassword: true` tells the frontend to route to the password-change step instead of
  the Dashboard (FR-007) — that step itself is out of scope for this feature.

**Response — 401 Unauthorized** (unregistered email, wrong password, OR deactivated account —
all three indistinguishable, per FR-004):
```json
{ "message": "Invalid email or password" }
```

**Response — 423 Locked** (account currently within its 15-minute lockout window, per FR-014):
```json
{ "message": "Account temporarily locked. Try again after {lockedUntil, time}." }
```
Returned even if the submitted password was correct — a locked account rejects every attempt
(FR-014).

**Response — 400 Bad Request** (missing/malformed `email` or `password`): standard validation
error; the frontend's own inline field validation (FR-002) should make this response rare in
practice but the backend still enforces it as the authoritative boundary (constitution Principle
IV — client-side validation is UX only).

## `POST /auth/refresh-token`

**Request**: no body — the refresh token is read from the httpOnly cookie automatically.

**Response — 200 OK**: `{ "accessToken": "string" }`, and re-issues the refresh cookie (rolling
expiry) if still within its validity window.

**Response — 401 Unauthorized**: refresh token missing, expired, or revoked (logged out elsewhere,
or account deactivated) — the frontend treats this as "signed out" and returns the user to
`/login` (spec edge case).

## `POST /auth/logout`

**Request**: no body — acts on the current refresh cookie.

**Response — 200 OK**: the corresponding session/refresh token is revoked server-side (FR-011);
response also clears the refresh cookie. Only this one session is revoked — other
devices/sessions for the same account are unaffected (spec edge case on concurrent sessions).

## Rate limiting (`POST /auth/login` and other `/auth/*` routes)

**Response — 429 Too Many Requests** (the source IP has exceeded the rate limit, per FR-016 —
independent of any single account's lockout state):
```json
{ "message": "Too many attempts. Please try again later." }
```
This is a coarser, secondary defense; it does not need to be distinguishable from a generic
failure beyond its status code (no dedicated frontend message is required — see spec.md
Assumptions).

## Every authenticated request (existing + new endpoints alike)

The backend MUST re-validate the access token's account status and role against current data on
every request (FR-010), not just at token-issuance time — a request from a since-deactivated or
role-changed account must fail with 401 even if the access token has not yet expired.
