# Quickstart: Fuel Accountability and Per-Employee Geofence (web)

Only Scenarios 1 and 2 can be run today. The rest wait on backend work that is specified but
unbuilt, and Scenario 3 onward waits on a client conversation as well as on code.

## Prerequisites

- `buildcore-api` running with feature 020 **Phases 1–2** (committed 2026-09-30)
- An employee with a face enrolment and a site with a geofence
- A device or emulated location — Chrome DevTools → Sensors → Location overrides both the
  coordinates and the reported accuracy

## Running

```bash
npm run dev
npm run lint && npx tsc --noEmit && npm run build
```

---

## Scenario 1 — the punch sends its accuracy (Phase 1, FR-014a)

1. Open the punch screen on a phone or in device emulation.
2. In the Network tab, punch in and inspect the request body.

**Expected**: `accuracyMeters` is present, a number, sourced from
`GeolocationPosition.coords.accuracy`.

**Watch for the silent failure**: the field is `accuracyMeters` (American, singular). Sending
`accuracyMetres` — the spelling used by the muster endpoint and the offline queue — is **ignored
without error**, the punch succeeds, and nothing anywhere indicates a problem. Read the request body
and confirm the exact key; do not infer it from a 201.

3. Set the emulated accuracy very high (say 5000m) and punch. **Expected today**: the punch is still
   accepted — backend Phase 3 is unbuilt, so nothing is refused yet. The accuracy is being recorded
   and allowed for, not acted on.
4. Simulate a device reporting no accuracy. **Expected**: the field is **omitted**, not sent as `0`
   (FR-014b). Zero asserts a perfect fix, which is the opposite of "unknown".

## Scenario 2 — punching requires connectivity (Phase 2)

1. Go offline (DevTools → Network → Offline).
2. Open the punch screen.

**Expected**: it states that a punch needs a connection and offers no punch action. It must read as
a condition, not a malfunction, and it must name the recovery — the worker asks their supervisor for
a correction for a day they worked but could not punch.

3. Confirm nothing was queued: inspect IndexedDB → `buildcore-my-workspace`. **Expected**: no new
   entry in the punch store.
4. Open the labour muster offline. **Expected**: **still queues.** The muster path is feature 013's
   and is deliberately untouched; this step exists to catch retiring too much.
5. Reconnect. **Expected**: no punch syncs, because none was taken.

## Scenario 3 — refusal messages ⚠️ needs backend Phase 3

**Do not build or run this before the client has seen the refusal-rate figure.** The backend's
Phase 2 produces it (`PunchRefusalsService.rateSince`) and its task list states that nothing in
Phase 3 begins until that conversation has happened.

When it is live, the test that matters is the one the spec's edge case names: with an emulated
position *inside* the fence but a terrible accuracy, the worker must be told **their phone cannot
place them** — not that they are in the wrong place. Telling somebody standing on site to move is
the specific failure FR-014 exists to prevent.

Also: punch three times in a row with a failing photo. **Expected**: the third message is not the
first message again — at some point the screen says to ask a supervisor.

## Scenario 4 — refused attempts ⚠️ needs backend Phase 3

The worker's own list of attempts, with time and reason. Separately, open their attendance for the
same day: **expected to show no punch at all** — not a refused one, not a pending one.

## Scenario 5 — location assignment ⚠️ needs backend Phase 4

An effective date is required; previous assignments stay visible; an exemption shows its author and
reason; a site's staff can be assigned in bulk. An employee with **no** assignment must state the
fallback on screen — they are validated against their site's geofence, as before.

## Scenario 6 — fuel exception review ⚠️ needs backend Phases 5–6

Actual average, benchmark, and shortfall in litres **and** rupees. An owned machine offers no hire
deduction. A dismissal without a reason is refused. A raised recovery shows its approval state and
reads as proposed, not applied.

## Mobile is a gate, not a polish pass

Every punch surface above is **mobile-critical** under Principle VI (FR-014c). A worker punches on a
phone at a gate. Run Scenarios 1–4 at 320px and treat a failure there as a failure, not a follow-up.
