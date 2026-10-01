# Implementation Plan: Access Granularity and Multi-Company (web)

**Branch**: `019-access-and-multi-company` | **Date**: 2026-10-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification at `specs/019-access-and-multi-company/spec.md`

**Backend counterpart**: `buildcore-api/specs/019-access-and-multi-company-backend`, whose
Phases 1–5 are **implemented and committed** (records dated 2026-09-30 in its `tasks.md`).
This plan consumes that work; it does not re-decide any part of it.

## Summary

Three client notes (17, 22, 24) became one feature because they are one question asked three
ways: *what may this person see, and in which company?*

The decisive fact about this plan is that **two of the three are already answered on the
server, and the web's job is much smaller than the spec implies** — but the third is larger.

| Spec area | Who answers it | What is left for the web |
| --- | --- | --- |
| Company selection (FR-001 – FR-006) | **The server.** `PUT /my/company-selection` stores it; every request resolves and re-validates it | A control, and a cache reset |
| Cash hiding (FR-012 – FR-015) | **The server.** `CashVisibilityInterceptor` shapes responses | Render an absence honestly |
| Permission levels (FR-007 – FR-011) | Server enforces; **web must newly read levels** | The real work of this feature |

### Why selection is not client state

`GET /settings/companies/selectable` returns the companies this caller may work in, and
`PUT /my/company-selection` records the choice. The server then resolves
`selectedCompanyId` **per request and re-validates it against the caller's accessible
companies every time** — `authenticated-user.ts` is explicit that a selection trusted
because it was stored is how revoked access becomes a cross-tenant read.

Three spec requirements therefore cost almost nothing:

- **FR-003** (selecting scopes every list, report and creation) — already true. `rlsContextFor`
  reads the selection; no screen passes a `companyId` to get it.
- **FR-004** (persists across reloads *and browser restarts*) — satisfied by the server, not by
  `localStorage`. It survives a different browser and a new device, which is strictly more than
  FR-004 asks and is the reason not to store it client-side at all.
- **SC-002** (survives restart, in Chrome and Safari) — becomes a confirmation rather than a build.

What the web owes is **FR-005**: clearing cached views belonging to the previous company. The
server scoping the next request does nothing about the answer to the last one still sitting in
the TanStack Query cache.

### Why cash hiding is mostly already done

`CashVisibilityInterceptor` hides amounts in the **response**, and the api wrote down why it
sits there rather than in each service: a filter in the query layer would change what is
stored-adjacent, and a check in thirty services is the same condition written thirty times
with one of them wrong.

A hidden amount arrives as `amount: null` with `amountHidden: true` beside it — **never zero**,
because "neither a reader nor a spreadsheet summing a column can tell a hidden amount from a
real one". That single contract decision is what makes **FR-013** (consistent across screens,
reports *and exports*) true by construction: an export built from the same response carries the
same nulls.

So the web's cash work is **FR-014** only — a screen whose meaning depends on hidden figures must
say it is incomplete rather than look broken or empty. `amountHidden` is the flag that makes
that renderable, and rendering it is the whole task.

## Two open spec markers are already answered, and are removed

`spec.md` carries both of these under "Needing the client's decision". Neither is open:

- **"With cash hiding on, may cash still be entered?"** — **Yes.** The interceptor "shapes the
  response; never touches a query or a row". Entry is untouched, so this never becomes the
  permission feature the marker feared, and no control disappears.
- **"Which screens count as cash?"** — **Wrong unit.** Nothing is decided per screen. It is
  decided per row, by `paymentMode`, plus a named list of unconditional fields. The list is
  kept honest by `cash-surfaces.spec.ts`, which parses `schema.prisma` and **fails** when an
  enum grows a `cash` value the constant does not name — so the question cannot go stale into a
  silent leak. The web does not hold a screen list at all, which is why it cannot drift from the
  server's.

The feared outcome — "hiding its amounts may leave a screen nobody can use" — is real and is
exactly what FR-014 exists for. It is a rendering requirement, not a client decision.

## Technical Context

**Language/Version**: TypeScript 5, React 19, Next.js 15 App Router
**Primary Dependencies**: TanStack Query, zod, react-hook-form, Tailwind, Heroicons
**Storage**: None client-side for this feature — the selection lives on the server (see above)
**Testing**: No test framework is installed (constitution `TODO(TESTING_STANDARD)`). Verification
is lint, type-check, build and recorded manual passes. **No test-file tasks may be generated.**
**Target Platform**: Desktop-first; the application shell is a mobile-critical surface, so the
switcher is in Principle VI scope (NFR-001)
**Project Type**: Web frontend consuming `buildcore-api`
**Performance Goals**: NFR-002 — a switch completes within 2s including the cache clear
**Constraints**: FR-016 — extend `NAV_MODULES` and the feature 014 guard; never duplicate them

### What exists already, and its state

| Thing | Where | State |
| --- | --- | --- |
| `CompanyProvider` / `useCompanyContext` | `app/ui/settings/company-context.tsx` | **Conflicts with the server.** See below |
| `visibleModules`, `moduleAccess` | `app/lib/permissions.ts` | Sound; needs a level dimension |
| `NAV_MODULES` | `app/lib/constants.ts` | `permissions: string[]`, matched with `.some()` |
| `currentUserSchema` | `app/lib/api/users.ts` | **Discards `grants`** — see below |
| Module guard | feature 014 | Extend, per FR-016 |

## The two findings that shape this plan

### F1 — the web throws the level data away

The server already sends it. `users/dto/user-response.dto.ts` declares
`grants: { permission, level }[]` and `users.service.ts` returns `caller.grants` on the
current-user endpoints.

The web's `currentUserSchema` parses `permissions: z.array(z.string())` and nothing else — and
because a zod object strips unknown keys by default, **`grants` is silently dropped on arrival**.

This matters more than its size suggests. `permissions` deliberately means *"the areas this
caller holds at some level"* — `authenticated-user.ts` says so, and keeping that meaning is why
the api's change was small. So a web that reads only `permissions` cannot tell a read-only role
from a writing one, and **FR-009 and SC-004 are unimplementable** until the schema parses
`grants`. Nothing is missing from the api; the data is on the wire.

This is the third instance this cycle of *the server sends it, the client discards it* — after
`ApiError.details` and the project-document `missingTypeIds`. Worth naming as a pattern: the
web's zod schemas are a silent filter, and a field nobody parsed looks identical to a field
nobody sent.

One trap to carry into the tasks: a `Permission` that is not read/write-shaped
(`CROSS_COMPANY_ACCESS`, `DATA_EXPORT`, the four `_APPROVE` values) **appears in `grants` at both
levels**, because the migration doubled every entry. Asking whether such a value is "write" is
meaningless rather than false, so level-aware helpers must answer from `permissions` for those
and from `grants` only for the areas where a level means something.

### F2 — `CompanyProvider` is now a second source of truth

`company-context.tsx` holds the selection in `useState` and defaults to `companies?.[0]?.id`.
The server now holds the selection too. Two answers to "which company am I in" is the defect,
not a missing feature:

- A user switches in the provider; the **server never hears**, so the next list comes back
  scoped to the server's selection while the UI insists otherwise.
- It gates on `CROSS_COMPANY_ACCESS`, but **FR-001 gates on having access to more than one
  company** — a different population, and the selectable list is what answers it.
- It renders its own `mb-4` selector inside page content, so FR-001's "on every screen" and
  FR-002's "visible at all times" cannot be met by mounting it anywhere sensible. The switcher
  belongs in the shell header.
- It **throws** without a provider, and nothing in the projects tree mounts one. That already
  cost a crash this cycle (recorded in `project-form.tsx` and `project-documents-panel.tsx`,
  which both had to stop using it) — a crash `tsc` and `next build` both pass straight over.

So it is **retired and replaced**, not extended. Its five existing consumers
(`project-documents-screen`, `signatories-screen`, `letter-kinds-screen`,
`company-documents-screen`, `use-plant-refs`, `use-asset-refs`) move to the shell-level
selection. That is the single largest piece of mechanical work in this feature, and the risk is
that a consumer is missed and keeps reading a provider that no longer exists — which is a
type error, and therefore caught.

## Constitution Check

| Principle | How this plan complies |
| --- | --- |
| I Component-Based Architecture | Level logic stays in `app/lib/permissions.ts` as pure functions beside `visibleModules`; no decision in a component body |
| II No Inline Styling | Tailwind only; the switcher reuses `inlineSelectClass` from `form-fields` |
| III Centralized Constants | FR-016 is this principle. `NAV_MODULES` gains a field; nothing is copied. All copy to `constants.ts` |
| IV Type Safety | `grants` gets a zod schema with a closed `AccessLevel` union — the fix for F1 is a parse, not a cast |
| V API Access Boundary | Company selection and cash visibility get typed clients; no component calls `fetch` |
| VI Responsive Design | NFR-001: the switcher is shell furniture and must operate at 320px without obscuring content |

No violations. No Complexity Tracking entries.

## Project Structure

### Documentation (this feature)

```
specs/019-access-and-multi-company/
├── spec.md
├── plan.md              # this file
├── contracts/
│   └── access-and-company.md
├── quickstart.md
├── tasks.md
└── checklists/requirements.md
```

### Source (changed or added)

```
app/lib/api/company-selection.ts   # NEW — selectable companies, set selection
app/lib/api/settings.ts            # cash visibility read/patch
app/lib/api/users.ts               # CHANGED — parse `grants` (F1)
app/lib/permissions.ts             # CHANGED — level-aware helpers
app/lib/constants.ts               # CHANGED — NAV_MODULES level dimension, copy
app/ui/company-switcher.tsx        # NEW — shell furniture (FR-001, FR-002)
app/ui/shell-header.tsx            # CHANGED — mounts the switcher
app/ui/settings/cash-visibility.tsx  # NEW — the control (FR-012)
app/ui/hidden-amount.tsx           # NEW — renders `amountHidden` (FR-014)
app/ui/settings/company-context.tsx  # RETIRED — see F2
```

## Phases

Ordered so the thing everything else depends on lands first, and so the riskiest mechanical
change is not also the first.

- **Phase 1 — Read the levels (F1).** Parse `grants`; add level-aware helpers; give `NAV_MODULES`
  its level dimension. Inert: nothing changes on screen. (FR-007, FR-016)
- **Phase 2 — Hide what cannot be written (FR-009).** Write controls disappear for read-only
  holders, module by module. This is the broadest phase and the one SC-004 measures.
- **Phase 3 — The guard reads levels (FR-008).** Extend feature 014's module guard; add the
  no-visible-modules message (FR-011).
- **Phase 4 — The switcher (FR-001 – FR-006).** The typed client, the shell control, the cache
  reset, the unsaved-changes warning. Retire `CompanyProvider` and move its six consumers.
- **Phase 5 — Cash (FR-012 – FR-015).** The setting control, and `amountHidden` rendered as a
  stated absence wherever it can appear.
- **Phase 6 — Verification.** NFR-001 at 320px, NFR-002 timing, and the module-by-module passes
  SC-004 and SC-005 require. Recorded, not asserted.

Phase 4 is deliberately **not** first despite being the feature's headline: it retires a provider
six screens depend on, and doing that before the level work is in place would put two large
changes in the same blast radius.

## The one thing most likely to go wrong

**FR-005, and it will look like it is working.**

Switching company tells the server, and every *subsequent* request is scoped correctly. The
danger is the cache: a query whose key omits the company id keeps serving the previous
company's answer, and it will look right because it *is* a real answer — just to the wrong
question. Nothing errors, nothing is empty, and the figures are plausible.

`queryClient.clear()` after a successful switch is the only honest default. Invalidating a
curated list of keys is the version that passes review and then fails the first time somebody
adds a query and does not think about companies — which is to say, it fails later, quietly, on
a screen nobody was looking at. SC-006 ("no data from a previous company remains visible,
verified by inspecting cached views") is written as an inspection for this reason, and the
inspection is a task, not an assumption.

The cost of `clear()` is a visible refetch, and NFR-002's 2-second budget is what makes that
acceptable rather than regrettable.

## Complexity Tracking

No entries. This feature removes a mechanism (`CompanyProvider`) and extends two others.

## Phase status

- [x] Plan written (2026-10-01)
- [ ] Phase 1 — Read the levels
- [ ] Phase 2 — Hide what cannot be written
- [ ] Phase 3 — The guard reads levels
- [ ] Phase 4 — The switcher
- [ ] Phase 5 — Cash
- [ ] Phase 6 — Verification
