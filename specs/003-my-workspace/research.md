# Research: My Workspace Frontend (Punch, Leave, Salary, Face Enrolment)

## 1. Dedicated shell: `app/my/` route group

**Decision**: A new `app/my/layout.tsx` provides a mobile-first shell (a bottom tab bar linking
Punch/Leave/Salary/Face-Enrol) independent of `app/dashboard/layout.tsx`'s sidenav shell. Both
shells sit behind the same `middleware.ts` authentication check (feature 001); no new auth
mechanism.

**Rationale**: Per the confirmed clarification — this feature's primary users are field/site
employees on phones, and `/my/*` has no existing sidebar entry the way Settings did.

**Alternatives considered**: Nest under `/dashboard/my/*` — rejected per the clarification;
recorded here only for completeness.

## 2. Cross-shell navigation for dual-role users

**Decision**: A small, dismissible link/button in the `/my/*` bottom-nav shell ("Admin Dashboard")
for a user whose token carries any admin-level permission (feature 002's `Permission` values),
and, symmetrically, a "My Workspace" entry added to `app/ui/dashboard/nav-links.tsx` — both are
plain `<Link>`s, not a merged layout.

**Rationale**: Satisfies spec FR-017/Edge Cases without collapsing two intentionally different
shells (mobile-first bottom-tab vs. desktop sidenav) into one compromise layout.

**Alternatives considered**: A single adaptive shell that switches sidenav/bottom-tab by viewport —
rejected: reintroduces exactly the "no dedicated shell" option the clarification already declined,
just implemented as one component instead of two routes.

## 3. Camera capture

**Decision**: A single reusable `CameraCapture` component (`app/ui/my/camera-capture.tsx`) wraps
`navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })` for a live `<video>`
preview, capturing a still frame to a `<canvas>` → `Blob` on tap. Reused by both Face Enrolment
(multi-capture, up to 5) and Punch (single capture per punch).

**Rationale**: `MediaDevices`/`getUserMedia` is the constitution's own named approach (NFR:
"browser MediaDevices API on web"); one shared component avoids duplicating camera lifecycle
handling (permission request, stream cleanup on unmount, error states) across two features.

**Alternatives considered**: A file input with `capture="user"` (delegates to the OS camera app) —
rejected: doesn't give a live in-page preview matching the PRD's "Live device camera capture"
wording, and produces a worse multi-shot enrolment flow (5 separate OS-camera round trips instead
of one continuous session).

## 4. Geolocation and client-side accuracy gate

**Decision**: `navigator.geolocation.getCurrentPosition()` with `enableHighAccuracy: true`; a punch
is blocked client-side (spec FR-007) when `coords.accuracy` (meters) exceeds a configured maximum,
read from `app/lib/constants.ts` — before any network request is made.

**Rationale**: Matches the constitution NFR ("platform Geolocation API with a minimum accuracy
threshold before a punch is accepted") and spec FR-007's explicit client-side gate, avoiding a
wasted round trip to a backend that would reject it anyway (server-side geofence check still
applies independently, per the backend's own contract).

**Alternatives considered**: Skip the client-side threshold check and let the backend's geofence
result be the only signal — rejected: spec FR-007 explicitly requires blocking before the network
request when accuracy is insufficient, not just handling a resulting exception after the fact.

## 5. Offline punch queue

**Decision**: A plain IndexedDB wrapper (`app/lib/offline-queue.ts`, using the native `indexedDB`
API directly — no added dependency) stores queued punches (photo blob, GPS, capturedAt) when
`navigator.onLine` is false or the submit `fetch` fails with a network error. A `window`
`'online'` event listener (registered once, in the `/my/*` layout) drains the queue in capture
order on reconnect. `@serwist/next` (already pre-approved, not yet used elsewhere in this repo) is
introduced for this feature to register a service worker that caches the `/my/*` app shell, so the
Punch screen itself can still open while offline — separate from the queue-sync mechanism itself.

**Rationale**: Matches the spec's own Assumption: a foreground `online`-event listener is
universally supported (unlike the Service Worker Background Sync API, which iOS Safari does not
support even as an installed PWA) — reliability across the actual target devices (site workers'
phones, likely including iPhones) matters more than syncing while the app is fully backgrounded.
Using native IndexedDB avoids a new dependency for what's a handful of straightforward operations
(put/getAll/delete on one object store).

**Alternatives considered**: Service Worker Background Sync API — rejected due to inconsistent
support (research.md context above); a small IndexedDB wrapper library (e.g. `idb`) — rejected as
an unnecessary new dependency for this feature's narrow storage needs (one object store, three
operations).

## 6. Data fetching: reusing `@tanstack/react-query`

**Decision**: Reuse `@tanstack/react-query` (introduced by the Settings feature, 002-settings) for
every list/detail fetch in this feature (attendance history, leave balance/applications, salary
periods/slip, enrolment status) — no new data-fetching pattern introduced.

**Rationale**: Consistent with this repo's own precedent (research.md §3 of the Settings feature's
plan) rather than reverting to manual `useState`/`useEffect` for a second data-heavy feature.

**Alternatives considered**: None seriously — introducing a second data-fetching pattern in the
same app would violate the spirit of Constitution Principle III's "no duplicated/inconsistent"
concern even though it's not literally a "new architectural dependency" question here.

## 7. Live server-synced clock

**Decision**: On mount, `My Punch` reads the `Date` response header (or a lightweight
`GET /my/punch/server-time` value, if the backend contract adds one) once, computes a
`clientNow - serverNow` offset, and ticks a local `setInterval` clock adjusted by that offset — no
continuous polling.

**Rationale**: A single offset calculation avoids a repeated network round trip just to display a
ticking clock, while still being "server-synced" per the PRD's wording closely enough for a
UI display (not a security-relevant timestamp — the actual punch `capturedAt` sent to the backend
is a fresh device timestamp at submission, validated server-side regardless).

**Alternatives considered**: Trust `Date.now()` alone with no server sync — rejected: the PRD
explicitly asks for a "server-synced" display, and a grossly wrong device clock would otherwise be
visibly misleading to the employee even though it doesn't affect the actual submitted `capturedAt`
validation.

## 8. Salary slip PDF download

**Decision**: `GET /my/salary/:period/pdf` returns a PDF blob; the frontend fetches it via
`apiFetch`-equivalent (raw `fetch`, since the response isn't JSON) and triggers a save via an
object URL + temporary `<a download>` click — no PDF-rendering library needed client-side, since
`buildcore-api` already renders the PDF (feature 003-my-workspace-backend, `pdfkit`).

**Rationale**: The backend already owns PDF generation; duplicating that client-side would be pure
waste.

**Alternatives considered**: None — this is the only sensible approach given the backend contract.

## 9. Accessibility and mobile-card patterns

**Decision**: Reuses the same `ResponsiveList` pattern and semantic-HTML/focus-trap conventions the
Settings feature establishes (its research.md §7/§8) for this feature's own tables (attendance
history, leave applications) and modals (Apply Leave, capture flows) — no new pattern invented.

**Rationale**: Consistency with the just-established repo convention; this feature is mobile-first
by construction (its own shell), so the card-vs-table distinction matters less here than in
Settings, but the same component is still the right reuse target for any tabular data (e.g.
attendance history, leave applications).

**Alternatives considered**: A bespoke mobile-only list component for this feature — rejected as
unnecessary duplication of a pattern that already exists and fits.
