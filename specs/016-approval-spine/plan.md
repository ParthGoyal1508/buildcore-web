# Implementation Plan: Approval Spine (Web)

**Branch**: `016-approval-spine` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

## Summary

Three things: one shared Action/Review control used identically everywhere, the latest action and
actor shown on the record itself, and one cross-module queue of what is waiting for you.

The chain, its rules and its enforcement are the backend's
(`buildcore-api/specs/016-approval-spine-backend`). This half renders them, and its only real
architectural decision is that the control is **one component**, not a pattern — because the
requirement is sameness, and sameness that depends on developers remembering has a half-life.

Attendance exceptions is the first consumer (spec Clarifications).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 16 (App Router, Turbopack)

**Primary Dependencies**: `@tanstack/react-query`, `zod`, `react-hook-form`. **Nothing new.**

**Storage**: None. Everything is server state; nothing persists to `localStorage` (data-model.md).

**Testing**: **No framework is installed** — constitution `TODO(TESTING_STANDARD)`. Verification is
`npm run lint`, `npx tsc --noEmit`, `npm run build` and the ten manual passes in quickstart.md.
**No test-file tasks may be generated from this plan.**

**Target Platform**: Vercel. Browsers including Safari.

**Project Type**: Web frontend.

**Performance Goals**: One approval-state request per list, not per row. Queue count must not pull
the queue.

**Constraints**: Principle VI as amended by constitution **v2.1.0** — these are desktop-designed
surfaces that must be *usable and unbroken* at 320px, not phone-optimised.

**Scale/Scope**: ~4 new components, 1 new API module, 1 new route, ~2 changed modules. No new
dependency.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Assessment |
|---|---|
| **I. Component-Based Architecture** | One shared `<ActionReview>`, plus `<LastAction>` and `<DecisionHistory>`. The contract deliberately excludes module identity from its props, so no module can diverge without changing the shared component. **Pass.** |
| **II. No Inline Styling (NON-NEGOTIABLE)** | Tailwind classes only. **Pass.** |
| **III. Centralized Constants (NON-NEGOTIABLE)** | All approval copy in `app/lib/constants.ts`, including the four inert-state messages keyed by code. No inline copy. **Pass.** |
| **IV. Type Safety & Validation** | `zod` schemas for all five view shapes, parsed at the boundary. **Pass.** |
| **V. API Access Boundary (NON-NEGOTIABLE)** | One typed module, `app/lib/api/approvals.ts`. Components never call `fetch`. **Pass.** |
| **VI. Responsive Design (NON-NEGOTIABLE)** | Approval surfaces are desktop-designed and **not** added to the mobile-critical closed list. Under v2.1.0 they must be unbroken at 320px — quickstart Pass 9. The 44px rule applies only where the control appears on a surface already mobile-critical. **Pass**, and the distinction is stated because conflating "unbroken" with "phone-first" is the easy mistake. |

No violations.

## Project Structure

```text
app/
├── ui/
│   ├── approvals/
│   │   ├── action-review.tsx        # NEW — the shared control
│   │   ├── last-action.tsx          # NEW — inline attribution
│   │   ├── decision-history.tsx     # NEW — disclosure on the record
│   │   └── queue-table.tsx          # NEW
│   └── dashboard/
│       └── sidenav.tsx              # CHANGED — pending badge
├── lib/
│   ├── api/approvals.ts             # NEW — typed access, zod schemas
│   └── constants.ts                 # CHANGED — approval copy and thresholds
└── dashboard/
    ├── approvals/page.tsx           # NEW — the queue
    └── hr/attendance/               # CHANGED — first consumer
```

## Approach

1. **The control and its API module**, with attendance exceptions as the only consumer. Everything
   testable end to end at the smallest size.
2. **Attribution** — `<LastAction>` inline, `<DecisionHistory>` as a disclosure.
3. **The queue and the badge**, reusing the existing reminder-badge mechanism rather than a second
   one.
4. **Further modules**, one at a time. Payroll deliberately not second (spec Clarifications): it is
   the most complex chain and a flaw in the shared component costs most there.

## Risks

| Risk | Handling |
|---|---|
| The control drifts per module — the exact failure this feature prevents. | One component; module identity is not a prop. `StatusBadge` in feature 004 is the worked precedent for why a pattern is not enough. |
| An inert control that says "no permission" when the truth is "you already decided". | `inertReason` is a server-supplied field with four values and four messages. Quickstart Pass 2 is written specifically to catch this. |
| A hardcoded role name that is right for one company and wrong for the other. | Level labels come from the server. Quickstart Pass 7 greps for the mistake. |
| N+1 approval-state requests from lists. | Batch endpoint in the contract; quickstart Pass 8 checks it in Network. Will not be noticed until a list gets long in production. |
| A failed decision loses a typed justification. | FR-006; quickstart Pass 3 induces the failure deliberately. |
| Dense tables break at 320px under the new constitutional floor. | `overflow-x` container or the existing `ResponsiveList` fallback; Pass 9. **No existing screen has ever been checked at 320px** — the previous gate did not ask — so expect findings. |

## Verification

`npx tsc --noEmit`, `npm run lint`, `npm run build`, then the ten passes in
[quickstart.md](./quickstart.md), including Safari.

With no test framework installed, these passes are the only verification that exists. Pass 2 and
Pass 8 are the two that catch what nothing else will.
