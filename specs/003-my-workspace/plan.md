# Implementation Plan: My Workspace Frontend (Punch, Leave, Salary, Face Enrolment)

**Branch**: `003-my-workspace` | **Date**: 2026-08-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-my-workspace/spec.md`

## Summary

Build a new, dedicated `/my/*` shell (bottom tab bar, no desktop sidenav — per clarification) with
four screens — Face Enrolment (camera capture + consent + re-enrolment lifecycle), My Punch (live
clock, camera + GPS punch, offline queueing, attendance history), My Leave (balance, apply, cancel),
My Salary (view + PDF download) — all consuming `buildcore-api`'s already-specified My Workspace
backend (`specs/003-my-workspace-backend/contracts/my-workspace-api.md`). This is the first feature
in `buildcore-web` to use device camera/GPS APIs, the first to need offline behavior (introducing
the pre-approved-but-unused `@serwist/next`), and reuses `@tanstack/react-query` and the
`ResponsiveList`/accessibility patterns the Settings feature (002) already established. See
[research.md](research.md) for the specific decisions.

## Technical Context

**Language/Version**: TypeScript 5.7, Next.js 16 (App Router), React 19 — unchanged.

**Primary Dependencies**: Existing — `react-hook-form` + `@hookform/resolvers` + `zod`, `clsx`,
`@heroicons/react`, `@tanstack/react-query` (introduced by feature 002, reused here). New —
`@serwist/next` (PWA/service-worker registration for offline app-shell caching, research.md §5),
already pre-approved in the constitution's Technology Stack. No PDF or IndexedDB-wrapper library is
added — PDF is rendered backend-side (research.md §8) and the offline queue uses native IndexedDB
directly (research.md §5).

**Storage**: N/A directly (Constitution Principle V) for persisted data — all punch/leave/salary/
enrolment data lives in `buildcore-api`. The one client-side store is the browser's IndexedDB,
holding only not-yet-synced offline punches (data-model.md "OfflineQueueEntry"), never a
second copy of confirmed data.

**Testing**: No automated test framework installed yet (constitution's documented gap).
Verification is manual per [quickstart.md](quickstart.md) — notably including camera/GPS/offline
scenarios that are inherently hard to automate without device/browser API mocking infrastructure
this repo doesn't have yet.

**Target Platform**: Mobile web / installable PWA (primary), desktop web (secondary, for the
dual-role admin cross-navigation case).

**Project Type**: Web application — this plan covers only the `buildcore-web` frontend; the backend
it depends on is already fully specified separately (`buildcore-api`, `specs/003-my-workspace-
backend`), not re-planned here.

**Performance Goals**: A punch round trip completes in under 15 seconds under normal conditions
(spec SC-001) — a UX-paced target dominated by camera/GPS acquisition time, not network latency.

**Constraints**: No inline styles (Tailwind + `clsx`, Principle II); no literal strings/URLs
inline — routes and copy in `app/lib/constants.ts` (Principle III); TypeScript `strict`, `zod`
at every API boundary (Principle IV); all `buildcore-api` calls through
`app/lib/api/my-workspace.ts` (Principle V); every screen mobile-first from the start and every
non-camera control keyboard-operable (Principle VI, spec FR-018, FR-020).

**Scale/Scope**: One new route group (`app/my/`) with four screens, ~15 new typed API functions,
one new shared camera-capture component, one offline-queue module, one service-worker
registration, two small nav-link additions (cross-shell navigation, research.md §2). No changes to
`/login` or the existing `/dashboard/*` screens beyond the one added nav-link entry.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Component-Based Architecture | Each screen's `page.tsx` is a Server Component doing the initial fetch; camera/GPS/offline-queue logic is `"use client"` under `app/ui/my/`; all API calls in `app/lib/api/my-workspace.ts`, offline-queue logic in `app/lib/offline-queue.ts` — not inline in components. | PASS |
| II. No Inline Styling (NON-NEGOTIABLE) | All new UI (bottom tab bar, camera preview, capture thumbnails, status badges) uses Tailwind + `clsx`. | PASS |
| III. Centralized Constants & Configuration (NON-NEGOTIABLE) | New routes, copy, GPS accuracy threshold, and offline-queue-age display text all in `app/lib/constants.ts`. | PASS |
| IV. Type Safety & Validation | Every `app/lib/api/my-workspace.ts` function `zod`-validates its response (data-model.md); PDF/blob responses are the sole exception (not JSON, handled per research.md §8). | PASS |
| V. API Access Boundary (NON-NEGOTIABLE) | All calls through `app/lib/api/my-workspace.ts`; no ad-hoc `fetch()` in components. | PASS |
| VI. Responsive & Mobile-First Design (NON-NEGOTIABLE) | This feature's own dedicated shell (research.md §1) is mobile-first by construction, not a retrofit; tabular data (attendance history, leave applications) reuses the Settings feature's `ResponsiveList` pattern; every non-camera control keyboard-operable (spec FR-020). | PASS |

No violations require a Complexity Tracking entry — `@serwist/next` is a pre-approved dependency
being exercised for the first time.

**Post-design re-check (after Phase 1)**: data-model.md and contracts/my-workspace-ui.md keep every
API call inside `app/lib/api/my-workspace.ts`, every JSON response `zod`-validated, every literal
in `constants.ts`, and the mobile-first/keyboard-operable requirements intact. Still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/003-my-workspace/
├── plan.md                     # This file
├── research.md                 # Phase 0 output
├── data-model.md               # Phase 1 output
├── quickstart.md               # Phase 1 output
└── contracts/
    └── my-workspace-ui.md      # Phase 1 output

(tasks.md — Phase 2 output, /speckit-tasks — not created by /speckit-plan)
```

### Source Code (repository root)

```text
buildcore-web/
├── package.json                                 # MODIFIED — adds @serwist/next
├── app/
│   ├── lib/
│   │   ├── constants.ts                         # MODIFIED — /my/* routes, copy, GPS threshold
│   │   ├── offline-queue.ts                     # NEW — IndexedDB wrapper (research.md §5)
│   │   └── api/
│   │       └── my-workspace.ts                  # NEW — all typed API functions, zod-validated
│   ├── ui/
│   │   └── my/
│   │       ├── bottom-nav.tsx                   # NEW
│   │       ├── camera-capture.tsx               # NEW — shared, research.md §3
│   │       ├── punch-clock.tsx                  # NEW — live server-synced clock (research.md §7)
│   │       ├── attendance-history.tsx           # NEW — ResponsiveList-based
│   │       ├── face-enrolment-status.tsx        # NEW
│   │       ├── leave-balance.tsx                # NEW
│   │       ├── leave-applications.tsx           # NEW — ResponsiveList-based
│   │       ├── apply-leave-form.tsx             # NEW
│   │       └── salary-slip.tsx                  # NEW
│   ├── ui/dashboard/
│   │   └── nav-links.tsx                        # MODIFIED — adds "My Workspace" entry
│   └── my/
│       ├── layout.tsx                           # NEW — bottom-nav shell, online-listener (research.md §5)
│       ├── punch/page.tsx                       # NEW
│       ├── leave/page.tsx                       # NEW
│       ├── salary/page.tsx                      # NEW
│       └── face-enrol/page.tsx                  # NEW
└── public/sw.ts (or app/sw.ts, per @serwist/next convention) # NEW — service worker registration
```

**Structure Decision**: Single Next.js App Router project (`buildcore-web`), adding one new
top-level route group (`app/my/`) alongside the existing `app/dashboard/`. The one structural
addition beyond components is a registered service worker (`@serwist/next`) for offline app-shell
caching.

## Complexity Tracking

*No entries — no constitution violations requiring justification (see Constitution Check above).*
