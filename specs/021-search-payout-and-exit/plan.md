# Implementation Plan: Search, Payout Communication and Exit Closure (web)

**Branch**: `021-search-payout-and-exit` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification at `specs/021-search-payout-and-exit/spec.md`

**Backend counterpart**: `buildcore-api/specs/021-search-payout-and-exit-backend`. **Search
(Phases 1–3) and exit clearance (Phase 7) are built and committed.** Phases 4–6 — slips, advance
recoveries and the transaction sheet — are specified and tasked but unimplemented.

## Summary

Four stories, and the backend has already built the two that matter most to a person using the
product daily.

| Story | Priority | Backend state | Can it ship? |
| --- | --- | --- | --- |
| US1 — cross-register search | P1 | **Phases 1–3: 28 of 29** | **Yes** |
| US4 — exit clearance | P2 | **Phase 7: 19 of 19** | **Yes** |
| US2 — slip delivery status | P2 | Phase 4: 0 of 13 | No |
| US3 — bank sheet & reconciliation | P2 | Phases 5–6: 0 of 18 | No |

So this feature splits cleanly in half: **US1 and US4 are buildable now**, and US1 is the one the
client asked for twice and the one with no equivalent in the product today.

### US1 is a replacement, not an extension

`app/ui/search.tsx` exists. It is **18 lines of dead code**: a presentational input with a
magnifying-glass icon, no state, no query, no results list, and **no importer anywhere in the app**.
It is left over from the Next.js dashboard template this project started from.

It is worth saying plainly because a glance at the file tree suggests search is half-built. Nothing
of it is reusable beyond the icon, and treating it as a starting point would mean growing a real
feature inside a stub whose shape was chosen by a tutorial.

### What the backend's search already decides for us

- **Authenticated, with no `@RequirePermissions` on the controller.** Authorisation is per *register*
  inside the registry: a caller lacking a register's permission gets an empty contribution from it.
- **A caller who may not see a register is never told it exists.** No entry appears in
  `unavailableSources`. This is FR-005 enforced server-side, and the web must not undo it by
  rendering a "Vendors (no access)" group — an empty group is a disclosure.
- **An exact code match sorts first.** Beyond that, ordering is not specified, so the web must not
  impose its own sort and silently defeat it.
- **Each result says which field matched**, code or name. FR-001b, and the reason is in the spec:
  to somebody who typed something code-shaped, an unexplained name match reads as a wrong result.

## The two open markers are now closed

- **"Should salary slips send automatically or on an explicit action?"** → **An explicit action**
  (decision of 2026-10-01). This matches what the backend's own T042 prescribes, and the asymmetry
  is the whole argument: an explicit send can be automated later, whereas an automatic send that was
  wrong has already emailed 500 people. So US2's screen has a send control, not only a status view.
- **"Who may waive a clearance item?"** → **`EMPLOYEES` at write level**, which is what the backend
  shipped. Its controller records that waiver authority remains an open client question and that
  until it is answered the waiver requires the same permission as the rest of the screen. That is a
  working default, not a resolution — but it no longer blocks the web, because tightening it later
  changes a permission constant rather than a design.

## A cross-feature dependency worth naming

The backend's exit-clearance controller says it directly: *"Under 019's level model the GET needs
read and the waiver needs write, derived from the verb — which is exactly right here, since waiving
writes off company money."*

So **US4's waiver control depends on feature 019's web Phase 1** — the one that stops
`currentUserSchema` discarding `grants`. Without it the web cannot distinguish `EMPLOYEES` at read
from `EMPLOYEES` at write, and the waiver button would be offered to every reader of the clearance
screen, with the server's 403 as the only thing stopping them.

This is a genuine ordering constraint between two features, not a note. 019 Phase 1 is nine small
tasks and lands first.

## Technical Context

**Language/Version**: TypeScript 5, React 19, Next.js 15 App Router
**Primary Dependencies**: TanStack Query, zod, Tailwind, Heroicons
**Storage**: None client-side
**Testing**: No test framework is installed (constitution `TODO(TESTING_STANDARD)`). Verification is
lint, type-check, build and recorded manual passes. **No test-file tasks may be generated.**
**Target Platform**: Desktop-first. Dashboard search is shell furniture and therefore in Principle VI
scope; the clearance and payout screens are head-office work and are not mobile-critical
**Project Type**: Web frontend consuming `buildcore-api`
**Performance Goals**: NFR-003 — debounce and cancel superseded requests, so typing does not generate
a request per keystroke
**Constraints**: Principle V for every read; all copy in `constants.ts`

### What exists already

| Thing | Where | State |
| --- | --- | --- |
| Search input | `app/ui/search.tsx` | **Dead stub, unused.** Replace |
| Employee search | `app/ui/dashboard/employee-search.tsx` | A different thing — one register, on the group dashboard |
| Offboarding | `app/ui/hr/offboarding-panel.tsx` | Exists; gains the clearance list |
| Payroll run detail | `app/ui/hr/payroll-run-detail.tsx` | Exists; gains delivery status in US2 |
| Letters on a subject | `app/ui/letters/subject-letters.tsx` | Built in 017; the pattern US4 follows for assets |

## Constitution Check

| Principle | How this plan complies |
| --- | --- |
| I Component-Based Architecture | One `SearchResults` component; grouping and keyboard handling in it, not spread across the page |
| II No Inline Styling | Tailwind only |
| III Centralized Constants | Register labels, the minimum-term message and the empty state all in `constants.ts`. **Register names are copy** — unlike document kinds, these four are fixed by the backend's union, not company configuration |
| IV Type Safety | `register` as a closed union of the backend's four values; `matchedOn` as `'code' \| 'name'` |
| V API Access Boundary | `app/lib/api/search.ts` and `app/lib/api/exit-clearance.ts`; no component calls `fetch` |
| VI Responsive Design | Dashboard search is shell furniture — operable at 320px, including keyboard selection |

No violations. No Complexity Tracking entries.

## Project Structure

```
specs/021-search-payout-and-exit/
├── spec.md          # amended 2026-10-01 — both markers closed
├── plan.md          # this file
├── contracts/search-and-clearance.md
├── quickstart.md
├── tasks.md
└── checklists/requirements.md
```

```
app/lib/api/search.ts              # NEW — US1
app/lib/api/exit-clearance.ts      # NEW — US4
app/lib/api/hr-payroll.ts          # CHANGED — slip delivery, bank sheet (US2, US3)
app/ui/dashboard-search.tsx        # NEW — replaces app/ui/search.tsx
app/ui/search.tsx                  # DELETED — dead stub
app/ui/hr/exit-clearance.tsx       # NEW — US4
app/ui/hr/slip-delivery.tsx        # NEW — US2
```

## Phases

- **Phase 1 — Search (US1).** The typed client, the control, grouped results, keyboard navigation,
  the minimum-term state. Unblocked.
- **Phase 2 — Exit clearance (US4).** The outstanding list, the asset group, the waiver, the
  settlement gate. Unblocked, **after 019 Phase 1**.
- **Phase 3 — Slip delivery (US2).** ⚠️ Needs backend Phase 4. Includes the explicit send control
  decided on 2026-10-01.
- **Phase 4 — Bank sheet and reconciliation (US3).** ⚠️ Needs backend Phases 5–6.
- **Phase 5 — Verification.**

## The one thing most likely to go wrong

**FR-005 — and the failure is a disclosure, not a bug report.**

The requirement: an empty result must say so plainly and **must not reveal that a matching record
the user may not see exists**. The backend holds this correctly — a register the caller lacks
permission for contributes nothing and is deliberately absent from `unavailableSources`, so that the
register's existence is not disclosed.

Every natural way to write a helpful search UI undoes that:

- Rendering a group header per register, so "Vendors — no results" appears for someone with no vendor
  access. The header is the disclosure.
- Showing "4 of 5 registers searched", or any count of what was consulted.
- A distinct "you don't have access to some results" message, which is the disclosure stated outright.
- Differing empty states — "no vendors matched" versus "nothing matched" — which lets a user infer
  what exists by watching which message appears.

So the rule for this app is narrow and worth writing into the component: **render only groups that
returned rows, and use one empty state for every case.** A user with access to one register and a
user with access to four see the identical screen when nothing matches.

The second-order version is more subtle: this must hold as the user *types*. A term that briefly
matches a forbidden record and then stops must not flicker a group header in and out.

## Complexity Tracking

No entries.

## Phase status

- [x] Plan written (2026-10-01)
- [ ] Phase 1 — Search
- [ ] Phase 2 — Exit clearance (needs 019 Phase 1)
- [ ] Phase 3 — Slip delivery ⚠️ gated on backend Phase 4
- [ ] Phase 4 — Bank sheet ⚠️ gated on backend Phases 5–6
- [ ] Phase 5 — Verification
