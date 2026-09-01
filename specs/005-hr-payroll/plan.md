# Implementation Plan: HR & Payroll Frontend (Employees, Attendance, Leave, Payroll, Challans, Loans, Daily Workers)

**Branch**: `005-hr-payroll` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-hr-payroll/spec.md`

## Summary

Build seven admin screens under `/dashboard/hr/*` (Employees, Attendance, Leave, Payroll,
Challans, Loans, Daily Workers) plus a re-enrolment queue, consuming `buildcore-api`'s
already-specified HR & Payroll backend. The two largest pieces of new UI are the eight-tab
Employee form (a dedicated page, not a modal — research.md §2) and the payroll/salary-slip flow.
This feature also promotes two components (`CameraCapture`, the salary-slip renderer) and one
utility (geolocation acquisition) from My Workspace's feature-specific location to a shared one,
since Daily Worker capture and admin salary-slip viewing both need them without duplication. See
[research.md](research.md) for all nine decisions.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing only — `react-hook-form` + `@hookform/resolvers` + `zod`,
`clsx`, `@heroicons/react`, `@tanstack/react-query`. No new dependency; this feature promotes
existing My Workspace components to a shared location rather than adding anything new.

**Storage**: N/A directly (Constitution Principle V) — all data lives in `buildcore-api`.

**Testing**: No automated test framework installed yet (constitution's documented gap).
Verification is manual per [quickstart.md](quickstart.md).

**Target Platform**: Desktop web (primary, admin-facing) + mobile web — the Daily Worker
Attendance capture screen is specifically mobile-optimized within the same shell (research.md §1),
consistent with this app's blanket mobile-first principle applying to every screen regardless of
primary usage pattern.

**Project Type**: Web application — this plan covers only the `buildcore-web` frontend; the
backend it depends on is already fully specified separately (`buildcore-api`,
`specs/005-hr-payroll-backend`).

**Performance Goals**: Employee onboarding (all eight tabs + documents) completable in under 1
hour (spec SC-001, a UX-paced target); daily worker enrolment under 2 minutes, attendance marking
under 15 seconds per worker (spec SC-004).

**Constraints**: No inline styles (Tailwind + `clsx`, Principle II); no literal strings/URLs
inline (Principle III); TypeScript `strict`, `zod` at every API boundary (Principle IV); all
`buildcore-api` calls through `app/lib/api/hr-payroll.ts` (Principle V); every screen mobile-first
and keyboard-operable, built in per-component from the start (Principle VI, spec FR-020); PII
fields masked by default everywhere, reveal always an explicit per-field action (spec FR-003).

**Scale/Scope**: The largest frontend feature specced so far — eight route areas (adding
Reimbursements as its own page; Offboarding/F&F and Attendance Import compose into existing
Employee Detail/Attendance pages rather than adding new top-level routes), ~38 new typed API
functions, ~31 new components, one existing page (`app/dashboard/hr` stub → real landing page),
two components + one utility promoted to shared locations, `nav-links.tsx`'s existing "HR &
Payroll" entry finally resolving to real content. User Stories 11–13 were added during a
master-PRD alignment pass after this feature's original build — no other route/story changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Component-Based Architecture | Each area's `page.tsx` is a Server Component doing the initial fetch; interactive forms/tables are `"use client"` under `app/ui/hr/`; all API calls in `app/lib/api/hr-payroll.ts`. | PASS |
| II. No Inline Styling (NON-NEGOTIABLE) | All new UI uses Tailwind + `clsx`, matching existing patterns. | PASS |
| III. Centralized Constants & Configuration (NON-NEGOTIABLE) | New routes and copy in `app/lib/constants.ts`; no inline literals. | PASS |
| IV. Type Safety & Validation | Every `app/lib/api/hr-payroll.ts` function `zod`-validates its response (data-model.md); PII fields typed as `{ masked, full }` per research.md §5, never a bare string that could be accidentally logged/displayed unmasked. | PASS |
| V. API Access Boundary (NON-NEGOTIABLE) | All calls through `app/lib/api/hr-payroll.ts`; admin salary-slip fetching is explicitly its own function, never reusing My Workspace's caller-scoped one (research.md §4). | PASS |
| VI. Responsive & Mobile-First Design (NON-NEGOTIABLE) | `ResponsiveList` reused for every table; every form/modal/filter keyboard-operable, built into each component's task from the start (research.md §9) rather than a Polish-phase retrofit. | PASS |

No violations require a Complexity Tracking entry.

**Post-design re-check (after Phase 1)**: data-model.md and contracts/hr-payroll-ui.md keep every
API call inside `app/lib/api/hr-payroll.ts`, PII fields on the masked/reveal path, and the
salary-slip data-fetching boundary correctly separated from My Workspace's. Still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/005-hr-payroll/
├── plan.md                    # This file
├── research.md                # Phase 0 output
├── data-model.md              # Phase 1 output
├── quickstart.md              # Phase 1 output
└── contracts/
    └── hr-payroll-ui.md       # Phase 1 output

(tasks.md — Phase 2 output, /speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
buildcore-web/
├── app/
│   ├── lib/
│   │   ├── constants.ts                          # MODIFIED — /dashboard/hr/* routes, copy
│   │   ├── geolocation.ts                        # NEW — promoted from My Workspace
│   │   └── api/
│   │       ├── hr-payroll.ts                     # NEW — all typed API functions
│   │       └── settings.ts                       # MODIFIED — Reimbursement Categories CRUD
│   │                                             #   functions (research.md §11)
│   ├── ui/
│   │   ├── shared/
│   │   │   ├── camera-capture.tsx                # MOVED from app/ui/my/
│   │   │   └── salary-slip.tsx                   # MOVED from app/ui/my/
│   │   ├── my/                                    # MODIFIED — imports updated to app/ui/shared/
│   │   ├── settings/
│   │   │   └── reimbursement-category-tab.tsx     # NEW — 6th tab on 002's employee-setup page
│   │   └── hr/
│   │       ├── employee-form.tsx                 # NEW — eight-tab (research.md §2)
│   │       ├── employee-list.tsx                 # NEW
│   │       ├── employee-detail-tabs.tsx          # NEW
│   │       ├── masked-field.tsx                  # NEW — research.md §5
│   │       ├── documents-tab.tsx                 # NEW
│   │       ├── transfer-modal.tsx                # NEW
│   │       ├── attendance-table.tsx              # NEW
│   │       ├── mark-edit-modal.tsx               # NEW
│   │       ├── exceptions-modal.tsx              # NEW
│   │       ├── modifications-modal.tsx           # NEW
│   │       ├── holidays-panel.tsx                # NEW
│   │       ├── leave-applications-table.tsx      # NEW
│   │       ├── leave-balance-table.tsx           # NEW
│   │       ├── payroll-list.tsx                  # NEW
│   │       ├── generate-payroll-form.tsx         # NEW
│   │       ├── challan-tabs.tsx                  # NEW
│   │       ├── loan-list.tsx                     # NEW
│   │       ├── new-loan-modal.tsx                # NEW
│   │       ├── daily-worker-registry.tsx         # NEW
│   │       ├── daily-worker-attendance-capture.tsx # NEW
│   │       ├── reenrolment-queue.tsx             # NEW
│   │       ├── exit-modal.tsx                    # NEW — US11
│   │       ├── fnf-summary.tsx                   # NEW — US11
│   │       ├── reimbursements-list.tsx           # NEW — US12
│   │       ├── decide-claim-modal.tsx            # NEW — US12
│   │       ├── pay-claim-modal.tsx               # NEW — US12
│   │       └── attendance-import-modal.tsx       # NEW — US13
│   └── dashboard/
│       ├── hr/
│       │   ├── page.tsx                           # NEW — landing (nav-links target resolves)
│       │   ├── employees/
│       │   │   ├── page.tsx, [id]/page.tsx, new/page.tsx, [id]/edit/page.tsx
│       │   ├── attendance/page.tsx                 # MODIFIED — adds Import action (US13)
│       │   ├── leave/page.tsx
│       │   ├── payroll/
│       │   │   ├── page.tsx
│       │   │   └── [runId]/employees/[employeeId]/slip/page.tsx
│       │   ├── challans/page.tsx
│       │   ├── loans/
│       │   │   ├── page.tsx
│       │   │   └── [id]/schedule/page.tsx
│       │   ├── daily-workers/
│       │   │   ├── page.tsx
│       │   │   └── attendance/page.tsx
│       │   └── reimbursements/page.tsx             # NEW — US12
│       └── settings/
│           └── employee-setup/page.tsx              # MODIFIED — adds the 6th tab (research.md §11)
├── middleware.ts                                    # MODIFIED — /dashboard/hr/* permission
│                                                    #   mapping (EMPLOYEES/ATTENDANCE/PAYROLL/
│                                                    #   CHALLANS/LOANS/DAILY_WORKER_REGISTRY)
└── app/ui/dashboard/nav-links.tsx                    # unchanged (already points at /dashboard/hr)
```

**Structure Decision**: Single Next.js App Router project (`buildcore-web`), substantially filling
out `app/dashboard/hr/` (previously just a `nav-links.tsx` entry with no real destination). Two
components and one utility move from `app/ui/my/`/inline to `app/ui/shared/`/`app/lib/`; no other
existing feature's routes or contracts change.

## Complexity Tracking

*No entries — no constitution violations requiring justification (see Constitution Check above).*

---

## Amendment 2026-09-01 — TDS, Advances, Registers, Late-Coming; Recruitment and Labour Handover

Covers spec FR-030 to FR-041. Adds four screen areas; **no new permission** (reuses `PAYROLL`,
`ATTENDANCE`, `REPORTS`).

**Two handovers, both ratified 2026-09-01:**

- Recruitment, onboarding, letters, and the resignation report move to **011-recruitment**. This
  feature's exit/F&F screens gain links out rather than building those screens (spec FR-038).
- Daily-worker and labour attendance screens move to **013-labour** (spec FR-039). This feature must
  not build them.

**Constitution re-check**: Principle III — tax sections, deduction heads, and colour maps from
constants. Principle IV/V — new calls on the existing typed HR/payroll modules with `zod`.
Principle VI — wide register tables scroll within their own container. PASS.

### Phase A1: Handover (do first — removes scope)

- [ ] Remove any daily-worker/labour attendance screen from this feature's scope (spec FR-039)
- [ ] Add the mount point in the employee screen for 012's "Assets in custody" panel (spec FR-040) —
      **coordinate with 012's Phase 5**
- [ ] Add exit/F&F links to 011's resignation record and letter generation (spec FR-038) —
      **blocked by 011's Phase 7**

### Phase A2: Types and API

- [ ] Extend the HR/payroll API modules with tax-slab, declaration, advance, register, and
      shift-compliance functions and `zod` schemas

### Phase A3: US14 — TDS (P1)

- [ ] `TaxSlabEditor.tsx`: ordered slab rows with **client-side contiguity and non-overlap
      validation highlighting the offending boundary and disabling Save** (spec FR-031) — a
      deterministic rule per the 2026-09-01 ratification
- [ ] `TaxDeclarationForm.tsx`: **capped deductible amount shown live beside the entered value**
      (spec FR-032); proof upload; verify action with cut-off-month helper text
- [ ] Missing-PAN employees surfaced in the run exception list with the higher-rate explanation
- [ ] Quarterly TDS report and Form 16 data views; export via the established handling

### Phase A4: US15 — Salary Advances (P2)

- [ ] `SalaryAdvanceTable.tsx` + form, **visually and navigationally distinct from the Loans
      screen** so the two are not conflated (spec FR-033)
- [ ] Exceeds-limit inline warning; duplicate open advance 409 inline with a link
- [ ] Capped-recovery helper text explaining the carry-forward (spec FR-034)

### Phase A5: US16 — Registers (P2)

- [ ] `SalaryRegister.tsx`: full earnings/deductions breakup with column totals; project filter for
      the manpower-cost view; **available only for processed or paid runs with an explanatory state
      otherwise** (spec FR-035)
- [ ] Explicit reconciliation warning when totals diverge from the run (spec FR-035)
- [ ] `DeductionReport.tsx`: heads split statutory / non-statutory, presented for comparison against
      the challan screens (spec FR-036)
- [ ] Wide tables scroll within their own container at mobile widths

### Phase A6: US17 — Late-Coming (P3)

- [ ] `LateComingReport.tsx`: late days, late minutes, early departures, short hours, repeat marker
- [ ] **Explicit "no shift assigned" and "no punch times" markers rather than zero** (spec FR-037)
- [ ] Copy stating lateness does not deduct pay (spec FR-037)

### Phase A7: Polish

- [ ] Mobile spot-check; `npx tsc --noEmit`
- [ ] Confirm register / deduction report / challan reconciliation on screen (SC-A01)
