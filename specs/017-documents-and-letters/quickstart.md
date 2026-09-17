# Quickstart: Documents and Letters (017, web)

**Date**: 2026-09-15 · Contract: [contracts/letter-composer.md](./contracts/letter-composer.md)

No test framework is installed in this repository (constitution `TODO(TESTING_STANDARD)`), so these
manual passes **are** the verification. 016 showed that is not a formality: its browser passes found
a real 320px defect, and the automated attempts around them produced three separate confident,
plausible, wrong readings. Treat a green pass as evidence, not proof.

## Prerequisites

```bash
# API on :3000 with the 017 migrations applied
npm run build && npm start        # web on :3001 — a PRODUCTION build, see the warning below
```

> **Use a production build for anything you intend to report.** 016's sweep recorded a dev-server
> reading that the production build contradicted, and separately a `next-server` process that
> survived `pkill -f "next start"` and served a stale build whose error page measured as a *passing*
> 320px. Kill the port by pid and confirm it is free before measuring.

---

## Pass 1 — The missing document is named

Open company documents with seven of eight kinds uploaded. The missing kind must be **named**. A
panel reading "7 of 8 complete" fails this pass.

## Pass 2 — An expiring kind asks for the date before submitting

Select a kind that expires and try to submit without a date. The form must ask first, not let the
server refuse. Then confirm the server still refuses if you bypass the form — the client asking is a
courtesy, not the enforcement.

## Pass 3 — Aadhaar is download-only

Confirm Aadhaar renders as a restricted entry with a download action and **no inline preview**. Then
open the letter template builder and confirm Aadhaar does not appear in the field picker at all
(FR-013a).

## Pass 4 — A work order cannot be issued before approval

Compose a work order for a vendor while its 016 chain is pending.

**Issue must be absent**, with the approval state shown in its place through the shared control. A
disabled button with a tooltip fails this pass — the reader needs to know *who* is being waited on,
which is what `ActionReview` already says.

Then approve as the director and confirm Issue appears without a manual reload.

## Pass 5 — The preview is the document

Preview a letter, issue it, download it. They must match. If the preview is a browser-side
approximation, some field will differ — and the spec says an approximation is worse than no preview.

## Pass 6 — A failed issue loses nothing

Type into the composer's variable fields, break the connection, submit.

The failure must be visible, the typed values must survive, and the screen must not navigate. Note
the *wording*: 016 shipped a control that displayed "Internal Server Error" here and it took a
manual pass to notice. A transport failure should read as one.

## Pass 7 — Project readiness in the list, one request

Open a project list of 50 with readiness shown. In the Network tab, confirm **one** readiness request.

This is the pass most likely to be skipped and the one whose absence costs most: three projects in
development hide an N+1 perfectly.

## Pass 8 — 320px

Every new surface at 320px: company documents, project documents, letter kinds, the composer,
signatories.

Measure by **actually scrolling** — `window.scrollTo(2000,0)` then read `scrollX` — not by reading
`documentElement.scrollWidth`, which reports overflow for content correctly contained in an
`overflow-x-auto` scroller and produces false failures. A table scrolling inside its own container is
correct; one pushing the body sideways is not.

Expect findings. 016 found the product broadly sound at 320px but individual pages broken, and the
composer is the densest new surface here.

## Pass 9 — No role name is invented

```bash
grep -rn "Super Admin\|HO User\|Site Admin\|'HR'" app/ui/letters/ app/ui/documents/ app/lib/api/letters.ts
```

Expect nothing. Level labels and signatory names come from the server, because two companies may map
the same slot differently.

## Pass 10 — Safari

Repeat Passes 4 and 6 in Safari (or WebKit). Session and cookie behaviour differs most there and this
product has been bitten before. 016 found WebKit identical to Chromium on every surface, which is a
useful baseline — a difference here would be new information.

---

## What these passes cannot cover

- **Load.** NFR-001's 150 concurrent users remains unverified across this product.
- **Whether the preview is legally adequate.** It matches the issued document; that is a rendering
  claim, not a legal one. The signature is an image and the product makes no non-repudiation claim
  (clarified 2026-09-15).
- **Whether eight required kinds is the right eight.** Configuration, not code.
