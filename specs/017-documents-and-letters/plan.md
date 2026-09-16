# Implementation Plan: Documents and Letters (web)

**Branch**: `017-documents-and-letters` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/017-documents-and-letters/spec.md`, clarified 2026-09-15. Backend contract:
`buildcore-api/specs/017-documents-and-letters-backend/contracts/documents-and-letters.md`.

## Summary

Seven screens' worth of work, but only two genuinely new *ideas*: a document store with a
completeness view, and a letter composer whose Issue button is gated by an approval chain it does not
own.

Everything else is assembly from parts this repo already has. The upload-with-expiry pattern exists
in employee documents. The approval-state display exists as feature 016's shared `ActionReview`
control and **must be reused, not re-drawn** (web FR-010a). The typed-module boundary, the constants
module and the responsive list are all established.

The interesting risk is not any single screen. It is that the letter composer is the first place in
this product where an action is blocked by something the browser cannot evaluate — and the specific
way to get it wrong is to render an Issue button and let the server refuse it.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 16 (App Router)

**Primary Dependencies**: `@tanstack/react-query`, `zod`, Tailwind, `clsx`, `@heroicons/react`

**Storage**: none client-side. Documents upload through the `/bff` same-origin proxy (feature 015);
downloads are binary responses already handled by `authFetchBlob`.

**Testing**: **No test framework is installed** (constitution `TODO(TESTING_STANDARD)`). Verification
is `npx tsc --noEmit`, `npm run lint`, `npm run build`, plus the manual passes in
[quickstart.md](./quickstart.md). **No test-file tasks may be generated.**

**Target Platform**: Modern browsers. Responsive floor **320px** (constitution v2.1.0).

**Project Type**: Next.js frontend against the NestJS API.

**Performance Goals**: One approval-state request per list, never one per row — the batch contract
016 established and 017 inherits.

**Constraints**: Principle V (all API access through `app/lib/api`), Principle III (copy in
`app/lib/constants.ts`), Principle II (no inline styling).

**Scale/Scope**: 7 user stories, ~6 new screens, ~4 new typed API modules.

## Constitution Check

| Principle | Assessment |
|---|---|
| **III. Centralized constants** | All new copy goes in `app/lib/constants.ts`. Document kind labels come **from the server**, not from a client constant — the required set is company configuration and two companies may differ. Only fixed UI prose is local. |
| **V. API access boundary** | Four new typed modules under `app/lib/api`: company documents, project document requirements, letter kinds/templates/signatories, letters. No component calls `fetch` directly. Binary downloads reuse `authFetchBlob`. |
| **II. No inline styling** | Tailwind classes only, as in every existing surface. |
| **Responsive floor 320px** | Every new screen is checked at 320px. 016's sweep found the product is broadly fine at that width but that individual pages fail, so this is a real check with expected findings, not a formality. |
| **Reuse over re-draw** | FR-010a requires the letter composer to use 016's `app/ui/approvals/action-review.tsx`. A second approval display would diverge the first time one was changed — which is the failure 016 FR-001 exists to prevent. |

**Gate result**: PASS.

## Project Structure

```
app/
├── lib/api/
│   ├── company-documents.ts      NEW — zod schemas + typed calls
│   ├── project-documents.ts      NEW
│   ├── letters.ts                NEW — kinds, templates, signatories, issue
│   └── constants.ts              EXTENDED — new copy only
├── dashboard/settings/
│   ├── company-documents/page.tsx    NEW — US1
│   ├── letter-kinds/page.tsx         NEW — US5, the template builder
│   └── signatories/page.tsx          NEW — signature images
├── dashboard/projects/
│   └── [id]/documents/               NEW — US2
├── ui/
│   ├── documents/
│   │   ├── document-upload.tsx       NEW — shared: kind, file, expiry
│   │   ├── completeness-panel.tsx    NEW — present/missing, from the server
│   │   └── restricted-badge.tsx      NEW — Aadhaar is download-only (FR-013a)
│   └── letters/
│       ├── letter-composer.tsx       NEW — variable fields + preview + gated Issue
│       ├── letter-list.tsx           NEW — issued vs executed (FR-013)
│       └── countersign-upload.tsx    NEW — FR-012
└── ui/approvals/action-review.tsx    REUSED UNCHANGED — not forked
```

**Structure Decision.** Document screens live under `dashboard/settings/` because company documents
are company configuration, matching where the approvals settings screen landed in 016. Project
documents live under the project, because that is where someone asks the question. The shared upload
and completeness components sit in `app/ui/documents/` so the company and project screens cannot
drift into two different upload experiences.

## The one thing most likely to go wrong

**Rendering an Issue button the server will refuse.**

For work orders, LOIs and purchase orders the chain must be complete before issue (backend FR-015a,
web FR-010a). The browser cannot compute that — authority resolves from role-slot mappings server-side
— so the composer must render the approval state it is given and withhold Issue until the state says
otherwise.

016 already solved this exact problem and the pieces are sitting there: `canActNow`, a four-value
`inertReason`, and a control that renders each of the four differently. 017's job is to *use* them.
The failure mode to avoid is the one 016's `research §2` describes — telling a Super Admin they lack
permission when the truth is that they already decided, or that a slot is unmapped.

## Complexity Tracking

| Item | Why accepted |
|---|---|
| A template builder (US5) is a genuinely complex surface | FR-011 requires new letter kinds without a code change, which means the field picker is data-driven. Mitigated by the spec's own constraint that the builder edits structured fields and fixed text, **not arbitrary markup** — so this is a form, not an editor. |
| Preview must match the issued document exactly | The spec says an approximation is worse than no preview. Simplest way to honour that is to render the preview **server-side through the same path** as the real document, rather than reimplementing rendering in the browser. Flagged for `/speckit-tasks` to make a task. |

## Phase status

- **Phase 0 — research**: folded into the backend's [research.md](../../../buildcore-api/specs/017-documents-and-letters-backend/research.md); every decision that shapes this interface (signature is an image, issue is gated, Aadhaar is download-only) was settled there and in the 2026-09-15 clarifications. No web-specific unknowns remain.
- **Phase 1 — design**: [contracts/letter-composer.md](./contracts/letter-composer.md), [quickstart.md](./quickstart.md).
- **Post-design constitution re-check**: PASS.

**Next**: `/speckit-tasks` — but the backend contract must be real before much of this can be built,
so the API half should lead.

---

## Amendment — 2026-09-16 (Clarifications session of the same date)

Design for FR-019, FR-020 and FR-021. The backend plan's amendment of the same date carries the
contract these depend on.

### W1 — the upload control offers every defined kind; the panel still counts eight

`getCompanyDocuments()` gains `supplementary` from the server. The upload control's `kinds` list is
built from all three lists rather than from `missing` + `present`, so any kind the company has
defined can be filed. `CompletenessPanel` is unchanged in what it counts: supplementary documents
render in their own section beneath it. A count that moves when an unrelated certificate is filed
answers a different question than the one on screen.

### W2 — `actionForMissing` stops returning null

Where a required kind has no type (`documentTypeId === null`) the row gains a "Define and upload"
action that calls the new company-documents route, invalidates the query, and lands the
administrator on the upload form for the kind they just materialised. The typed client already
carried this distinction and documented the intent; only the screen discarded it.

### W3 — `CompanyProvider` per page, and `companyId` through every 017 client

Mounted on the four 017 pages individually, not on `app/dashboard/settings/layout.tsx`: that layout
wraps every settings section and `employee-setup` already mounts its own provider, so hoisting would
put two company selectors on that page.

All four typed clients — `company-documents.ts`, `project-documents.ts`, `letters.ts` (letters,
letter kinds, signatories) — take an optional `companyId` and append it as a query parameter. Two of
the four backend controllers already accepted it and were being called without it, so this half is
plumbing that should have been there at first write.

Query keys gain the company id. Without it react-query serves the previous company's documents from
cache on switch, which is FR-021's "every read carries the selected company" failing in the one way
that looks like it works.
