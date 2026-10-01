# Contract: Punch Accuracy, Refusal and Fuel Review (web ↔ api)

What this app sends and consumes for feature 020. Split by **what the backend can do today**,
because only the first part is live.

---

## Part 1 — position accuracy on the punch request (LIVE)

Backend Phase 1 is built. The field is optional and absent-safe.

```ts
POST /my/punch
{
  type: 'in' | 'out',
  photo: string,            // base64, data-URL prefix optional
  latitude: number,
  longitude: number,
  accuracyMeters?: number,  // ← the addition. 0 ≤ n ≤ 10_000
  capturedAt: string,       // ISO 8601
}
```

### `accuracyMeters`, not `accuracyMetres`

The punch DTO spells it the American way. `app/lib/offline-queue.ts` and the muster endpoint both
use `accuracyMetres`. These are two different field names on two different endpoints and **both are
correct where they are**.

Getting it wrong fails silently and in the worst possible way: `@IsOptional()` means an unrecognised
key is ignored, the punch succeeds, and it is judged on its raw point exactly as though accuracy had
never been sent. Nothing errors, nothing logs, and the bug only becomes visible once the hard
refusal exists — as honest workers being refused.

Source it from `GeolocationPosition.coords.accuracy`, which the browser already reports and the
punch screen already discards.

### What the server does with it

- Inside the fence when `distance ≤ radius + accuracy`, so a legitimate worker with a poor fix is
  not refused for the device's uncertainty.
- **A fix whose accuracy already exceeds the company's `punchAccuracyMaxMetres` gets no allowance
  at all** — otherwise the worst fixes would buy the largest allowance.
- Omitted entirely → `?? 0` → today's verdict, unchanged. Which is why this ships safely alone.

**FR-014b**: where the device reports no accuracy, the attempt is still permitted. Omit the field;
do not send `0`, which asserts a perfect fix.

## Part 2 — the refused response (NOT LIVE — backend Phase 3, 0 of 13, gated)

Today `POST /my/punch` returns **201 even when a check fails**, carrying
`faceMatchResult` and `geofenceResult` as `'matched' | 'exception'` / `'in_range' | 'exception'`,
because the punch is recorded either way. Phase 3 replaces that with a refusal.

```ts
{
  "code": "PUNCH_REFUSED_LOCATION",   // stable, branchable
  // ...message and cause-specific detail
}
```

| Code | Means | What the worker must be told |
| --- | --- | --- |
| `PUNCH_REFUSED_LOCATION` | Locatable, outside the fence once the allowance applies | where they must be |
| `PUNCH_REFUSED_UNLOCATABLE` | Reported accuracy exceeds the company maximum | their phone cannot place them |
| `PUNCH_REFUSED_FACE` | Mismatch **or** no detectable face | retake the photo |

`UNLOCATABLE` is a separate code from `LOCATION` precisely because the advice differs. Branch on the
code; never render the server's prose as the whole message and never collapse the two.

**No photo is retained on a face refusal** (backend plan D20). A mismatch means the system could not
establish whose face it is, and keeping an unattributed biometric against a named employee is worse
than the exception it replaces. `faceMatchDistance` is kept — a number is not a biometric. So the
web must not offer to show the worker "the photo that failed"; there isn't one.

### Nothing is recorded, and nothing is reviewed

A refused punch creates no attendance row of any kind — not pending, not unapproved. The day reads
as **no punch** to every later reader, and that guarantee is structural rather than per-reader: a
refusal is never stored where attendance is stored.

Consequences for this app:
- No refusal appears in the attendance view. Putting one there would recreate the "refused day" the
  backend forbids every reader from seeing.
- There is nothing to resubmit and no approval to track. The recovery is a **supervisor-raised
  correction** (feature 016), and the punch screen's job is to say so.

## Part 3 — the worker's refused attempts (NOT LIVE — backend Phase 3)

A list of **attempts**, not of days — separate from attendance for the reason in Part 2. Each
carries its time and its reason. A worker refused at 8am and asking at 5pm needs somewhere to look.

## Part 4 — location assignment (NOT LIVE — backend Phase 4, 0 of 12)

Per-employee fence **layered over** the site fence, never replacing it. An employee with no
assignment falls back to their site's geofence, as today — which is why shipping this refuses
nobody on day one (Clarifications, 2026-09-16).

Assignments are effective-dated and history is preserved, so a transfer is explicable months later.
A mobility exemption covers **location only** — never the face check, because mobility says where a
person legitimately works and the face check says who is holding the phone.

## Part 5 — fuel exceptions (NOT LIVE — backend Phases 5–6, 0 of 27)

`fuelBenchmark` and `fuelVarianceThresholdPercent` are already typed on equipment in
`app/lib/api/plant.ts`; the review surface and its consequences are not built on either side.

A reviewer raises a hire deduction, an operator recovery, both, or dismisses with a reason. A hire
deduction is **not offered for an owned machine** — there is no hirer to deduct from. A recovery
shows its approval state and is **not applied until approved**.

**The operator recovery cap is an open client question** (backend Phase 7, 0 of 6). Indian wage law
constrains what may be deducted from wages, and until that is answered the web must display a raised
recovery as proposed rather than imply a figure will reach a payslip.
