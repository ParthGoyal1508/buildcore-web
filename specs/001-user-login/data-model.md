# Data Model: User Login

These entities are conceptual (spec-level) and map to `buildcore-api`'s persistence layer, not to
anything `buildcore-web` stores directly — per Constitution Principle V, `buildcore-web` never
models or accesses these directly; it only sees them through API responses.

## User Account

Existing entity (owned by the Account Creation feature); login reads/enforces these fields.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Primary identifier |
| `email` | string | Unique, case-insensitive, trimmed (FR-003) |
| `passwordHash` | string | Never returned to the client; compared server-side only |
| `name` | string | Used in the "Welcome back, {name}!" message (FR-006) |
| `status` | enum: `active` \| `deactivated` | Deactivated accounts must fail login with the generic message (FR-004, edge case) |
| `role` | string/enum | Re-validated on every authenticated request (FR-010) |
| `mustChangePassword` | boolean | When true, successful credential check routes to password-change instead of Dashboard (FR-007) |

## Login Attempt Record

New, tracks brute-force state per account.

| Field | Type | Notes |
|---|---|---|
| `accountId` | string | FK to User Account |
| `consecutiveFailures` | integer | Incremented on each failed attempt; reset to 0 on success (FR-013) |
| `lockedUntil` | timestamp \| null | Set when `consecutiveFailures` reaches 5 (FR-012); cleared/ignored once past |

State transitions:
- `consecutiveFailures: 0` → (failed attempt) → `consecutiveFailures: n+1`
- `consecutiveFailures: 4` → (failed attempt) → `consecutiveFailures: 5`, `lockedUntil: now + 15m`
  (FR-012)
- Any state → (successful login) → `consecutiveFailures: 0`, `lockedUntil: null` (FR-013)
- `lockedUntil` in the future → any login attempt is rejected with the lockout message regardless
  of credential correctness (FR-014), and does not itself increment `consecutiveFailures` further

## Session

Represents one signed-in period on one device/browser. Not a client-side data model —
`buildcore-web` only ever holds the access token (in memory) and never reads the refresh token
directly (httpOnly cookie); this row describes what the *backend* tracks so it can revoke sessions.

| Field | Type | Notes |
|---|---|---|
| `accountId` | string | FK to User Account |
| `refreshTokenId` | string | Identifies this specific refresh token so it can be individually revoked (e.g., by logout) without affecting other devices' sessions |
| `expiresAt` | timestamp | `now + 30 days` if "Remember Me" was checked at login, otherwise a short session-length default (FR-009) |
| `revokedAt` | timestamp \| null | Set on logout (FR-011), account deactivation, or role/status change requiring re-auth (FR-010) |

## Activity Log Entry

New (or extends an existing Activity Log if `buildcore-api` already has one elsewhere), per FR-017.

| Field | Type | Notes |
|---|---|---|
| `eventType` | enum: `login_success` \| `login_failure` \| `account_locked` \| `logout` | |
| `accountId` | string \| null | Null only for `login_failure` against an unregistered email |
| `timestamp` | timestamp | |
| `ipAddress` | string | Originating request IP (FR-017); never paired with the attempted password (FR-018) |

## Client-side (buildcore-web) state — not persisted server-side data

| Item | Where held | Notes |
|---|---|---|
| Access token | In-memory module (`app/lib/api/auth.ts`), not `localStorage` | Lost on hard refresh; re-obtained via the refresh cookie (research.md §2) |
| "Remember Me" choice | Form state only, sent once at login | Not stored client-side after submission — the backend encodes the resulting duration into the refresh cookie's `Max-Age` |
