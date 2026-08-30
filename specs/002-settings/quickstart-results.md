# Quickstart validation results — Settings Module Frontend

**Run**: 2026-08-29, live local stack — `buildcore-api` on :3000 (with the Settings module) and
`buildcore-web` on :3001.
**Result**: **31/31 live checks passed**, plus a clean `next build` and `tsc --noEmit`.

The scenarios were executed against the running pair rather than by clicking through screens: each
check drives the exact endpoint, payload and header the corresponding UI component sends, including
the cross-origin CORS preflight the browser performs between :3001 and :3000.

| Scenario | Result | Evidence |
|---|---|---|
| Auth + CORS between the two origins | **PASS** | login 201; `access-control-allow-origin: http://localhost:3001`; `allow-credentials: true` |
| Permission gate input (`/users/me`) | **PASS** | returns `permissions[]` + `roleNames[]`, which is what `settings/layout.tsx` gates on |
| 1 — Company creation and scoping | **PASS** | create 201 with config defaults (12 / 3.25 / 4.81 / 8.33); case-variant short code 409; rate edit persists; deactivated company still listed; malformed GSTIN 400 |
| 2 — Roles and permission enforcement | **PASS** | all nine defaults listed with `assignedUserCount`; Super Admin `isProtected`; custom role created; invalid permission 400; editing Super Admin 403; delete returns `clearedAssignments` |
| 3 — User administration | **PASS** | list carries `roles[]`, `status`, `lastLoginAt`; `lastLoginAt` populated after login; deactivating the last Super Admin 409 |
| 4 — Reference masters | **PASS** | department created; exact duplicate 409; `?companyId=` narrows the list; shift created with `HH:mm` round-trip |
| 5 — Document types | **PASS** | new company seeded with 17 types; Aadhaar → `MandatoryNumber`, Photo → `Mandatory`; a new Expiry-only type → `Expiry` |
| 6 — Employee code series | **PASS** | reading twice does not consume a number; next code is `{SHORTCODE}-0001` |
| Route rendering | **PASS** | all five `/dashboard/settings/*` routes return 200; unauthenticated visitor 307s to `/login` |

The company response was also asserted field-by-field against the frontend's `companySchema`, so a
backend shape change would fail here rather than surfacing as `undefined` inside a component.

## Deviations from quickstart.md as written

- **Scenario 5 expects "the 16 defaults"** — 17 are seeded. The PRD's enumerated table lists 17
  rows; the spec's prose collapses the 10th and 12th marksheets into one entry.
- **Scenario 2.6 expects `role: null`** on a user whose role was deleted. The field is `roles: []`,
  an array, because an account can hold several roles at once.

## T039 / T040 / T042 — verified structurally, not in a browser

These three tasks are written as manual visual checks. There is no browser available in this
environment, so each was verified against the code's structure instead. **A human visual pass at a
real mobile viewport is still worth doing** — what follows establishes that the mechanisms are
present and used everywhere, not that they look right.

**T039 (mobile card layout, ≤428px)** — every Settings list renders through
`app/ui/settings/responsive-list.tsx`, which emits a `md:hidden` card stack and a `hidden md:table`
table from one column definition. All seven list-bearing components use it; no Settings screen
contains a raw `<table>`. (One remains in `app/ui/skeletons.tsx`, a feature-001 template file
outside this feature.)

**T040 (keyboard operability)** — zero `<div onClick>`/`<span onClick>` anywhere in the app; 9
native `<button>` elements; 7 `<label htmlFor>` bindings; 44 `focus-visible:outline` declarations.
`modal.tsx` moves focus in on open, wraps Tab at both ends, closes on Escape, and restores focus to
the trigger on close; dialogs carry `aria-modal`, tab strips `role="tab"`/`aria-selected`.

**T042 (failed save preserves entered data)** — no `onClose()` appears inside any `onError`
handler, so a rejected save always leaves the modal open. The company modal keeps all five tabs
mounted and toggles visibility (5 `'hidden'` class switches) rather than unmounting them, so a
rejection on one tab cannot discard what was typed on the other four.

## `npm run lint` — was broken project-wide, now fixed

The `lint` script was `next lint`, which **Next 16 removed**, and the project had no ESLint
installed. This predated this feature (it was broken on `main` too), so it was originally reported
rather than fixed.

It has since been repaired: `eslint` + `eslint-config-next` are installed, `eslint.config.mjs`
applies the same `core-web-vitals` and `typescript` rule sets `next lint` used to, and the script
is now `eslint .`. `eslint-config-next` v16 ships native flat configs, so they are spread in
directly — the `FlatCompat` wrapper the older docs describe throws a circular-structure error
against it.

`npm run lint` now passes clean. Three findings it surfaced were addressed, none of them in this
feature's own code:

- `tailwind.config.ts` used `require('@tailwindcss/forms')` in a TypeScript config
  (`@typescript-eslint/no-require-imports`). Converted to an `import`; verified the emitted CSS is
  byte-for-byte identical (27,291 bytes) before and after, so this is cosmetic.
- `app/lib/session.ts` assigns `window.location.href` on session loss. That is deliberate — a
  client-side `router.push()` would keep the React tree and every react-query cache entry holding
  the previous user's data alive across a logout. Documented with a scoped disable and an
  explanation rather than changed.
- `eslint.config.mjs`'s own anonymous default export, assigned to a named const.
