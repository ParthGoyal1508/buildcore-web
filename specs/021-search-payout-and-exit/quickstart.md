# Quickstart: Search, Payout Communication and Exit Closure (web)

Scenarios 1 and 2 run today. Scenarios 3 and 4 wait on backend Phases 4–6.

## Prerequisites

- `buildcore-api` with feature 021 Phases 1–3 and 7 (committed 2026-09-30)
- Seeded employees, vendors, equipment and projects, **in two companies**
- Two signed-in users: one with access to all four registers, one with access to **one**
- An employee with an exit record, an outstanding advance, and **an asset in their custody**

## Running

```bash
npm run dev
npm run lint && npx tsc --noEmit && npm run build
```

---

## Scenario 1 — search (Phase 1, US1)

1. Type a known **code**. **Expected**: matching records grouped by kind, each identifying itself,
   appearing as you type with no submit.
2. Type part of a project **name**. **Expected**: the project appears; the row says it matched on the
   name rather than the code (FR-001b).
3. Type a term below the minimum length. **Expected**: "keep typing" — **not** an empty result.
   Confirm the two states are visibly different (FR-001c).
4. Type something matching nothing. **Expected**: one plain empty state.
5. Choose a result. **Expected**: the full record opens.
6. **Keyboard only** (FR-004): tab to the control, type, arrow through results, Enter to open. No
   mouse at any point.
7. Watch the Network tab while typing a long term. **Expected**: debounced, and superseded requests
   cancelled — not one request per keystroke (NFR-003).

### Scenario 1b — the disclosure test, which is the one that matters

Sign in as the **single-register** user.

1. Search a term that matches records in a register they cannot see. **Expected**: nothing about that
   register appears — no group header, no count, no "some results hidden", and the **same** empty
   state the all-access user sees when nothing matches.
2. Compare the two users' screens side by side on a term matching nothing. **Expected**: identical.
3. Type a term character by character through a state where a forbidden record briefly matches.
   **Expected**: no group header flickers in and out. FR-005 has to hold mid-keystroke, not only at
   rest.
4. Search a record belonging to the **other company**. **Expected**: nothing, and nothing suggesting
   it exists.

## Scenario 2 — exit clearance (Phase 2, US4)

**Requires feature 019's web Phase 1 first** — without `grants`, step 4 cannot be tested.

1. Open a leaver's clearance. **Expected**: every outstanding item with its owner.
2. **Expected**: assets in custody appear as their **own group**, each with its site, expected return
   date and condition expectation.
3. Click through an asset. **Expected**: it opens that allocation in the asset register. **Expected
   absent**: any control here that returns the asset.
4. Sign in as a holder of `EMPLOYEES` at **read** only. **Expected**: the clearance is readable and
   **no waiver control appears**. Then as a write holder: the control appears. This is the step that
   depends on 019.
5. Submit a waiver with no reason. **Expected**: refused.
6. Submit one with a reason. **Expected**: recorded, showing its author — and the item still reads as
   waived rather than as returned. A waiver is not a discharge.
7. Attempt final settlement with items outstanding. **Expected**: unavailable, **naming them**.
8. **Expected absent**: any rupee figure for an unreturned asset. The backend computes none, by
   decision.

## Scenario 3 — slip delivery ⚠️ needs backend Phase 4

The send control (explicit, per the 2026-10-01 decision), the delivered/failed/undeliverable list,
and a retry that resends **only** failures. An unapproved run refuses delivery with its reason shown
rather than a disabled control with no explanation.

Worth testing once live: a run with one bad address among many. **Expected**: the others deliver and
the screen reads as partial, not as failed.

## Scenario 4 — bank sheet ⚠️ needs backend Phases 5–6

Advance recoveries as named lines; differences explicable line by line. An unparseable row **uploads
and is reported**, rather than failing the file.

## 320px

Dashboard search is shell furniture and is in Principle VI scope — including keyboard selection at
that width. The clearance and payout screens are head-office work and are not mobile-critical.
