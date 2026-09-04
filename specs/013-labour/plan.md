# Implementation Plan: Labour Management Frontend

**Branch**: `013-labour` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-labour/spec.md`

## Summary

Build a phone-first supervisor muster capture at `/labour/muster` plus six back-office route areas
under `/dashboard/labour/*` — Wage Rates, Workers, Gangs, Musters (approval), Payment Sheets,
Advances, and Reports. The muster capture is a three-step wizard that **reuses** the existing
`camera-capture.tsx`, the geofence and GPS handling from `punch-clock.tsx`, and the IndexedDB queue
in `app/lib/offline-queue.ts` — it introduces no second camera, geofence, or queue implementation.
Back-office screens are desktop-primary but responsive.

**Supersedes** the daily-worker surfaces implied by 005-hr-payroll, matching the backend supersession
ratified 2026-09-01. **Created by the 2026-09-01 gap-closure pass** against matrix rows 11, 12, 15,
and 18.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing — `react-hook-form` + `zod`, `@tanstack/react-query`,
`formatCurrency`, `StatusBadge`, `ResponsiveList`, `skeletons.tsx`, and critically
`app/ui/my/camera-capture.tsx`, `app/ui/my/punch-clock.tsx` (geofence/GPS handling), and
`app/lib/offline-queue.ts` (`enqueue`, `listQueued`, `getQueuedCount`, `drainQueue`).
**One new dependency is expected** for card-list virtualisation in muster step 2; the requirement is
the behaviour (spec FR-027), and the library is a research decision.

**Storage**: IndexedDB via the **existing** offline queue only — no new client store.

**Testing**: Manual per quickstart.md, plus an offline end-to-end check (SC-002) and a
large-muster responsiveness check on a mid-range phone (SC-008).

**Performance Goals**: A 200-worker muster stays responsive on a mid-range phone with no
memory-related failure (SC-008).

**Constraints**: All API calls through `app/lib/api/labour.ts`; site/project via the existing
`projects.ts` module and contractors via `partners.ts`; masked worker PII never written to any
client-side cache or storage (spec FR-013); face match is advisory and must never block or use an
error treatment (spec FR-009).

**Scale/Scope**: ~9 route files, ~26 components, ~30 typed API functions.

## Constitution Check (Frontend Principles)

| Principle | Check | Status |
|---|---|---|
| I. Component-based, server-first | Server Components by default; the muster wizard, camera capture, and queue indicator are necessarily client components and are the pushed-down boundary (spec FR-023). | PASS |
| II. No inline styles | Tailwind + `clsx` throughout (spec FR-025). | PASS |
| III. Centralized constants | Routes, attendance types, status labels, denominations, and colour maps in constants (spec FR-022). | PASS |
| IV. Type safety + zod | Every response validated at the boundary (spec FR-005). | PASS |
| V. API access boundary | All calls via `app/lib/api/labour.ts` (spec FR-004). | PASS |
| VI. Responsive Design: Desktop-First, Mobile-Critical Surfaces (NON-NEGOTIABLE) | **Split (constitution v2.0.0).** Muster capture is a named mobile-critical surface and stays mobile-first: one-handed at 320px, 44×44px targets, no hover-gated action (spec FR-026), verified at 320px. Every other screen in this feature (wage-rate masters, payment sheets, advances, reports) is desktop-first — designed at desktop width, wide tables scrolling in their own container, unbroken at 768px, `ResponsiveList` optional. Keyboard operability applies to both halves. | PASS |
| Reuse over reimplementation | Camera, geofence, and offline queue reused as a hard requirement (spec FR-006), not a preference. | PASS |
| `middleware.ts` route guard | Labour routes guarded with `DAILY_WORKER_REGISTRY`; reports additionally `REPORTS` (spec FR-002). | PASS |

## Project Structure

```text
app/labour/muster/page.tsx        # field surface, OUTSIDE /dashboard (spec FR-001)

app/dashboard/labour/
├── layout.tsx
├── wage-rates/page.tsx
├── workers/page.tsx
├── gangs/page.tsx
├── musters/page.tsx              # approval queue
├── payment-sheets/page.tsx
├── advances/page.tsx
└── reports/
    ├── deployment/page.tsx
    ├── attendance/page.tsx
    └── payment-register/page.tsx

app/lib/api/labour.ts
app/ui/labour/                    # ~26 components per data-model.md
middleware.ts                      # MODIFIED — labour route mapping
```

## Implementation Phases

### Phase 1: Shared Infrastructure

- [ ] Add "Labour" nav group to `nav-links.tsx`; add the muster entry to the field/`/my` surface
- [ ] Create `app/dashboard/labour/layout.tsx`
- [ ] Create `app/lib/api/labour.ts` with all typed API function stubs
- [ ] Extend `middleware.ts` for both `/dashboard/labour/*` and `/labour/muster`
      (spec FR-001, FR-002)
- [ ] Add labour constants — attendance types, statuses, currency denominations, colour maps
- [ ] Reuse the `usePermission` affordance so `LABOUR_APPROVE` actions are **not rendered** without
      the permission (spec FR-003)

**Checkpoint**: Nav, layout, API module, and guards ready.

### Phase 2: Types and zod schemas

- [ ] Define every interface and zod schema in `app/lib/api/labour.ts` — data-model.md
- [ ] Extend the existing `OfflineQueueEntry` shape to carry a muster payload — **extending the
      existing queue, not creating a second one** (spec FR-006)
- [ ] Permissive fallback so an unrecognised attendance type or status renders its raw label
      (spec FR-029)

**Checkpoint**: All types defined; the queue understands musters.

### Phase 3: US1 & US2 — Wage Rates, Workers, Gangs (P1)

- [ ] `WageRateTable.tsx` + `WageRateForm.tsx`: effective-dated history with a Current indicator;
      the prior rate visibly gains its Effective To on save; backdating 400 surfaced inline; locked
      rates render read-only with a tooltip (spec FR-018)
- [ ] "As of date" control filtering to rates in force
- [ ] `SkillCategoryMasters.tsx` with 409-guarded delete
- [ ] `WorkerForm.tsx`: engagement type conditionally reveals Contractor (from `partners.ts`);
      duplicate Aadhaar 409 inline with a link
- [ ] `WorkerTable.tsx` (`ResponsiveList`): **masked PII rendered as returned**; no client-side
      unmasking; unmasked detail never cached (spec FR-013)
- [ ] Face enrolment wired to 003's **existing** enrolment flow and `camera-capture.tsx`
- [ ] `GangForm.tsx` with the single-gang-membership 409 surfaced inline

**Checkpoint**: Masters and the registry exist; "Labour Wages Creation Per Project" is covered.

### Phase 4: US3 — Supervisor Muster Capture (P1, mobile-first) 🎯 the headline gap

- [ ] `MusterWizard.tsx` (client): three steps — Open Session, Mark Workers, Review & Submit — so a
      failure in one step does not discard another's work (spec FR-007)
- [ ] Step 1 reuses `punch-clock.tsx`'s GPS/geofence handling: shows site, date, accuracy, and
      geofence result. **Outside the fence or low accuracy → persistent warning banner and proceed**
      (ratified 2026-09-01); **no fix at all → blocked with retry** (spec FR-008)
- [ ] Step 2 `WorkerMusterCard.tsx`: large photo button reusing `camera-capture.tsx`, attendance-type
      control, conditional overtime field
- [ ] Gang bulk-add creating a card per active member, each still needing its own photo
- [ ] Low face match → **subtle "needs review" chip only**, never a dialog, never an error treatment
      (spec FR-009)
- [ ] Card list virtualised; photos lazy — a 200-worker muster must not exhaust phone memory
      (spec FR-027)
- [ ] Step 3 review: counts by attendance type, count of cards missing photos, **Submit disabled
      while any marked worker lacks a photo** (spec FR-010)
- [ ] Offline submit via the **existing** `enqueue`; queued indicator via `getQueuedCount`; automatic
      drain via `drainQueue`; drain failures surfaced with reason and retained for retry
      (spec FR-011)
- [ ] 409 handling that **preserves captured work** — duplicate muster offers to open the existing
      one; worker-at-two-sites highlights the offending card with the other site named (spec FR-012)

**Checkpoint**: Matrix row 11 is delivered — the module's primary field operation.

### Phase 5: US4 — Muster Approval (P1)

- [ ] `MusterQueue.tsx`: submitted first, oldest first, flags visible on the row
- [ ] `MusterDetail.tsx`: per-line worker, attendance type, overtime, photo, face-match indicator,
      applicable rate; **photos lazy-loaded** so a large muster does not block the page (spec FR-028)
- [ ] Approve hidden without the permission for flagged musters; Return requires a reason
- [ ] Approved musters render read-only; un-approval 409 names the payment sheet with a link

**Checkpoint**: The control that makes disbursement defensible is in place.

### Phase 6: US5 & US7 — Payment Sheets and Advances (P1, P2)

- [ ] `GenerateSheetModal.tsx`: period defaults to the company wage cycle; **missing-rate 409
      surfaced with project, skill category, and date plus a link to create the rate**
      (spec FR-014)
- [ ] `PaymentSheetTable.tsx`: per-line days, overtime, resolved rate and its source, gross,
      deductions, net, with column totals
- [ ] Approve hidden without the permission; approved sheets read-only; Reopen disabled once any
      line is disbursed with an explanatory tooltip
- [ ] `DenominationPanel.tsx`: note count per denomination plus per-worker residual, **print-clean**
      for the cashier (spec FR-015); contractor sheets group by contractor with no panel
- [ ] `AdvanceForm.tsx` + `AdvanceTable.tsx`: live per-instalment computation, exceeds-limit warning,
      recovery history, capped-recovery helper text (spec FR-017)

**Checkpoint**: Matrix rows 12 and 18 are delivered.

### Phase 7: US6 — Disbursement (P2)

- [ ] `DisburseModal.tsx`: cash requires an acknowledgement captured via **`camera-capture.tsx`**
      with Save disabled until captured (spec FR-016); bank disabled for a worker with no account
- [ ] Short payment requires a reason with carry-forward helper text
- [ ] Header summary of disbursed/pending counts and amounts; visible closure transition
- [ ] Reverse hidden without the permission; requires a reason
- [ ] Verified fully operable at tablet width with 44×44px targets

### Phase 8: US8 — Reports (P3)

- [ ] Deployment, attendance, and payment-register reports with grouping controls
- [ ] Export reusing the established synchronous / async handling (spec FR-031)
- [ ] Distinct empty states, not errors

### Phase 9: Polish

- [ ] Verify `formatCurrency` and `StatusBadge` usage throughout
- [ ] Verify skeleton / empty / error-with-retry on every screen (spec FR-030)
- [ ] TypeScript type check (`npx tsc --noEmit`)
- [ ] **Offline end-to-end walkthrough**: capture a full muster with the network disabled, confirm it
      queues and drains on reconnect losing no line (SC-002)
- [ ] Large-muster check: 200 workers on a mid-range phone (SC-008)
- [ ] Confirm no unmasked worker PII in any client-side storage (SC-005)
- [ ] Confirm by inspection that no second camera, geofence, or queue implementation was introduced
      (spec FR-006)

## Implementation deviations (2026-09-04)

Deltas from the plan above, recorded per the constitution's "update the spec when you
change it" rule:

- **No `middleware.ts`.** The spec repeatedly references `middleware.ts` route guards,
  but this app deliberately holds the access token in memory only, so the edge never
  sees it. Labour routes are guarded exactly like every other module — by `NAV_MODULES`
  + the `/dashboard` `ModuleGuard` (`DAILY_WORKER_REGISTRY`) and a `LabourLayout` section
  guard that additionally gates the reports sub-tree on `REPORTS` (FR-002). The field
  muster capture at `/labour/muster` (outside `/dashboard`) has its own layout guard.
- **GPS extracted to `app/lib/location.ts`.** The two-attempt GPS acquisition was pulled
  out of `punch-clock.tsx` into a shared module (`resolvePosition`, `assertAccurate`,
  `isAccurateEnough`); `punch-clock.tsx` now imports it, so there is a single GPS
  implementation the muster wizard reuses (FR-006). The punch flow gates on accuracy;
  the muster flow records the fix and flags low accuracy (record-don't-reject).
- **Offline muster uses a second object store in the same `offline-queue.ts` module.**
  The muster reuses the queue's mechanics (`openDb`, `promisify`, `DrainResult`, the
  capture-order replay) via `enqueueMuster`/`drainMusters`/`getQueuedMusterCount`, in a
  `muster-queue` store alongside `punch-queue` in the same IndexedDB database. A separate
  store — rather than the one shared store the data-model imagined — keeps the punch
  drain and the muster drain from submitting each other's payloads; both run the
  identical logic. No second queue *module* or second IndexedDB *database* was
  introduced.
- **Synchronous handling only.** Export/async-job affordances (FR-031) are deferred to
  match the backend's synchronous-only posture (no queue infrastructure yet).
- **Live face-match chip deferred.** Face match is computed server-side on submit, so the
  "needs review" chip renders on the muster approval detail rather than live on the
  capture card. The capture flow still reuses `camera-capture.tsx` for every photo and
  the acknowledgement image, and never blocks on face match (FR-009).

