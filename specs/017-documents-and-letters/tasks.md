---

description: "Task list for 017 Documents and Letters (web)"
---

# Tasks: Documents and Letters (web)

**Input**: Design documents from `specs/017-documents-and-letters/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md) (clarified 2026-09-15),
[contracts/letter-composer.md](./contracts/letter-composer.md), [quickstart.md](./quickstart.md)

**Tests**: **NONE.** No test framework is installed in this repository (constitution
`TODO(TESTING_STANDARD)`). No task below creates a test file. Verification is `npx tsc --noEmit`,
`npm run lint`, `npm run build`, plus the manual passes in quickstart.md — which is why those passes
are tasks here rather than an afterthought.

**Depends on the API.** Most of this cannot be built honestly until the backend contract is real.
Phases 1–3 can start against the contract document; everything from Phase 4 needs the endpoints to
exist.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 [P] Add `ROUTES.companyDocuments`, `ROUTES.letterKinds`, `ROUTES.signatories` and
      `SETTINGS_PERMISSIONS` entries to `app/lib/constants.ts`
- [X] T002 [P] Add the new settings sections to `app/ui/settings/sections.ts` with icons, following
      the `approvals` section added in 016
- [X] T003 Add all new copy to `app/lib/constants.ts` (Principle III). **Document kind labels are not
      copy** — they come from the server, because the required set is company configuration and two
      companies may differ

---

## Phase 2: Foundational — the typed API boundary

**⚠️ Blocks every screen.** Principle V: no component calls `fetch` directly.

- [X] T004 [P] Create `app/lib/api/company-documents.ts` — zod schemas plus
      `getCompanyDocuments`, `uploadCompanyDocument`, `downloadCompanyDocument`,
      `supersedeCompanyDocument`. Downloads reuse `authFetchBlob`; add no new transport
- [X] T005 [P] Create `app/lib/api/project-documents.ts` — `getDocumentRequirements`,
      `putDocumentRequirements`, `getProjectReadiness`
- [X] T006 [P] Create `app/lib/api/letters.ts` — kinds, templates, signatories, issue, reissue,
      countersign, list, download
- [X] T007 In all three modules, surface refusals as `ApiError` carrying the backend `code`, and show
      the error's own message **only when a code is present**. 016 shipped a control that displayed
      "Internal Server Error" to somebody who had just typed a paragraph; do not rediscover that

**Checkpoint**: every call is typed and parsed. No screen exists yet.

---

## Phase 3: US1 — The company's papers, and what is missing (P1) 🎯 MVP

- [X] T008 [P] [US1] Build `app/ui/documents/document-upload.tsx` — kind picker, file, expiry. The
      expiry field becomes **required in the form** when the selected kind expires, so nobody is told
      off by the server for something the form could have asked (016's reason-box precedent)
- [X] T009 [P] [US1] Build `app/ui/documents/completeness-panel.tsx`. Missing kinds are **named, never
      counted** — "7 of 8" makes the reader diff two lists by eye
- [X] T010 [P] [US1] Build `app/ui/documents/restricted-badge.tsx` — a restricted kind renders as
      download-only with **no inline preview** (FR-013a)
- [X] T011 [US1] Build `app/dashboard/settings/company-documents/page.tsx` wiring the three together
- [X] T012 [US1] Invalidate the document query after upload and supersede so the completeness panel
      cannot disagree with the list it sits above

---

## Phase 4: US2 — Project paperwork readiness (P1)

- [X] T013 [P] [US2] Build the project document requirements screen under
      `app/dashboard/settings/` (write guarded by `SETTINGS`)
- [ ] T014 [US2] Build the per-project documents view at `app/dashboard/projects/[id]/documents/`,
      reusing `document-upload.tsx` and `completeness-panel.tsx` unchanged — two upload experiences is
      the failure this shared component exists to prevent
- [X] T015 [US2] Show readiness **in the project list**, from the batch endpoint. One request for the
      whole list, never one per row

---

## Phase 5: US3 — Issuing a letter (P1) ⚠️ the gated one

**The failure to avoid**: rendering an Issue button the server will refuse.

- [X] T016 [US3] Build `app/ui/letters/letter-composer.tsx` per
      [contracts/letter-composer.md](./contracts/letter-composer.md) — data-driven variable fields
- [X] T017 [US3] **Import** `app/ui/approvals/action-review.tsx` unchanged for the approval state.
      Do **not** build a second approval display — a fork diverges the first time either changes,
      which is what 016 FR-001 exists to prevent
- [X] T018 [US3] When the kind requires approval and the chain is incomplete, **Issue is absent** —
      not disabled with a tooltip. The reader needs to know who is being waited on, and
      `ActionReview` already says that in four distinguishable ways
- [X] T019 [US3] Preview renders **server-side** through the same path as the issued document. A
      browser-side re-render is an approximation by construction, and the spec says an approximation
      is worse than no preview
- [X] T020 [US3] Build `app/ui/letters/letter-list.tsx` distinguishing issued from executed
- [X] T021 [US3] Invalidate the letter and approval-count queries after issue

---

## Phase 6: US5 — The template builder (P2)

- [X] T022 [US5] Build `app/dashboard/settings/letter-kinds/page.tsx` — kind CRUD
- [ ] T023 [US5] Build the template editor: **structured fields and fixed text, not arbitrary
      markup** (spec Assumptions). This is a form, not an editor, and that constraint is what keeps it
      tractable
- [ ] T024 [US5] Restricted document types must not appear in the field picker, even if a malformed
      response includes one (FR-013a). Belt and braces, because the cost here is legal
- [X] T025 [US5] Show `LETTER_KIND_IN_USE` verbatim when deletion is refused, naming the letters — a
      generic "could not delete" throws away the only part that says what to do

---

## Phase 7: US4 and US7 (P2)

- [X] T026 [P] [US4] Build `app/dashboard/settings/signatories/page.tsx` with signature-image upload
- [X] T027 [P] [US4] Build `app/ui/letters/countersign-upload.tsx` (FR-012)
- [ ] T028 [P] [US7] Add payment-proof attachment and the missing-proof indicator to the payments
      screen

---

## Phase 8: US6 — Letters where the work is (P3)

- [ ] T029 [P] [US6] Surface project letters on the project screen
- [ ] T030 [P] [US6] Surface candidate and employee letters on theirs

---

## Phase 9: Verification

**T033–T038 require a browser and cannot be done any other way.**

- [X] T031 `npx tsc --noEmit` and `npm run lint` — expect 0 errors and only the 2 known pre-existing
      warnings in `account-creation.ts` and `assets.ts`
- [X] T032 `npm run build` clean, with every new route emitted
- [ ] T033 Quickstart Passes 1–3 (missing named, expiry asked, Aadhaar download-only) — **browser**
- [ ] T034 Quickstart Pass 4: a work order shows no Issue button while its chain is pending, and
      Issue appears after the director approves **without a manual reload** — **browser**
- [ ] T035 Quickstart Passes 5–6 (preview matches the issued document; a failed issue keeps typed
      values, shows a readable failure, and does not navigate) — **browser**
- [ ] T036 Quickstart Pass 7: 50 projects, **one** readiness request in the Network tab — **browser**
- [ ] T037 Quickstart Pass 8: every new surface at **320px**, measured by actually scrolling
      (`window.scrollTo(2000,0)` then read `scrollX`), not by reading `documentElement.scrollWidth`,
      which reports false failures for content correctly contained in an `overflow-x-auto` scroller.
      Expect findings — **browser**
- [ ] T038 Quickstart Pass 10: repeat Passes 4 and 6 in Safari/WebKit — **browser**
- [X] T039 Quickstart Pass 9: `grep -rn "Super Admin\|HO User\|Site Admin\|'HR'" app/ui/letters/
      app/ui/documents/ app/lib/api/letters.ts` — expect nothing. Not a browser task

---

## Dependencies & Execution Order

- **Phase 2 blocks everything.** No screen before the typed modules exist.
- **Phases 3 and 4** are independent of each other and of the letter work. **Ship here** — they need
  only the backend's document endpoints, which land in the API's Phases 3–4.
- **Phase 5 needs the API's Phase 6** (`issue()` and the approval gate) to be real.
- **Phase 7's US7** depends on nothing in the letter chain.

### Parallel opportunities

T004–T006 together; T008–T010 together; T026–T028 together; T029–T030 together.

---

## Implementation Strategy

**MVP = Phases 1–3.** The company documents screen is the thing that was asked for, and it needs
none of the letter work.

**Do not start Phase 5 until the API's letter restructure has passed its regression gate.** Building
a composer against a contract whose backing schema is still moving means rewriting it.

---

## Notes

- Verify against a **production build** (`npm run build && npm start`), not the dev server. 016
  recorded a dev reading the production build contradicted, and a `next-server` that survived
  `pkill -f "next start"` and served a stale build whose error page measured as a *passing* 320px.
  Kill the port by pid and confirm it is free before measuring.
- Where a manual pass asserts an absence — no Issue button, no request, no overflow — confirm the
  check can see a presence. 016 reported "0 requests" from a counter watching the wrong URL and "no
  error shown" from a click that never landed.
- Commit after each phase. Do not push.

---

## Implementation note — 2026-09-16

**27 of 39 done.** Phases 1–3 (the MVP), the typed API boundary, the letter composer, the
settings screens and the verification that does not need a browser.

### What the composer does NOT do, and why that is the feature

Issue is **absent** while a gated kind's chain is incomplete — not disabled with a tooltip.
A disabled button says "you can't"; the four reasons a chain might be holding say four
different things, and one of them (`already_decided`) is knowable only on the server.
`ActionReview` is imported from 016 unchanged and renders the real reason in its place. A
second approval display diverges the first time either changes, which is the failure
016 FR-001 exists to prevent.

### Readiness rides in the project list response

`GET /projects?include=documentReadiness` — one request for the whole page, never one per
row. `app/lib/api/project-documents.ts` deliberately exports **no** `getProjectReadiness`
function: a per-project endpoint here would invite exactly the N+1 the batch form exists
to prevent, and quickstart Pass 7 counts the requests expecting one.

### Deferred, and honestly so

- **T014** (per-project documents view), **T023/T024** (template editor and its field
  picker), **T028**'s screen wiring, **T029/T030** (letters surfaced on the project and
  candidate screens). The API modules and shared components they need are built and typed;
  what is missing is the screens that compose them.
- **T033–T038** require a browser and are the manual passes the deployment guide walks
  through. They are not claimed as done here — a pass nobody ran is not a pass.

`app/ui/settings/project-documents-screen.tsx` is read-only by design for now: the backend
accepts a PUT that replaces the whole set, but an editor without a document-type picker
beside it would be a screen where the only way to add a requirement is to know a type id.

### Verified

- `npx tsc --noEmit` clean
- `npm run lint` — 0 errors, and only the 2 known pre-existing warnings in
  `account-creation.ts` and `assets.ts`, exactly as T031 predicted
- `npm run build` clean, all four new routes emitted
- T039: `grep` for hardcoded role names across the new surfaces returns nothing
