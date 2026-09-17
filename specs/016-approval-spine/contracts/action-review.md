# Contract: the shared `<ActionReview>` component

**Feature**: 016-approval-spine | **Date**: 2026-09-13

This is the contract that makes sameness enforceable. A module that cannot express its needs through
this interface must have the interface extended — **not fork the component** (research.md §1).

## Props

```ts
{
  state: ApprovalState;          // from the item's own endpoint
  onDecide: (action, reason?) => Promise<void>;
  entityLabel: string;           // "this attendance correction" — for confirmations
  size?: 'inline' | 'full';      // table cell vs detail view
}
```

Deliberately **not** props: role names, permission values, module identity, copy. Each would let one
module diverge — which is the failure mode this component exists to prevent.

## Behaviour

| `state.canActNow` | `inertReason` | Renders |
|---|---|---|
| `true` | — | Approve / Reject / Return, enabled |
| `false` | `awaiting_other` | Inert, "Waiting on {awaitingUserName}" |
| `false` | `already_decided` | Inert, "You approved this at {levelLabel}" |
| `false` | `not_authorised` | Inert, "{levelLabel} decides this" |
| `false` | `slot_unmapped` | Inert + warning, names the settings screen |

The four inert states are four different sentences because they have four different remedies
(research.md §2). `slot_unmapped` is the only one that is a fault rather than a state, and it reads
that way.

## Rules

1. **Reason required** for reject and return. Requested inline; the decision is not sent without it.
2. **No double submission** — disabled while in flight, with visible progress.
3. **Reason survives failure.** A rejected submission keeps the typed text; retry does not retype.
4. **Only a 401 from renewal signs anyone out.** A failed decision throws to the caller; it never
   navigates away. Feature 015 established this and it is restated because losing a screen mid-review
   is exactly the regression worth guarding.
5. **Branch on `inertReason`, never on message text.**
6. **44px targets only where inherited.** Approval surfaces are desktop-designed under Principle VI
   (constitution v2.1.0); they must be *unbroken* at 320px, not phone-optimised. Where the control
   appears on a mobile-critical surface, that surface's rules apply.

## Attribution

`<LastAction state={...} />` renders the latest action, actor and time. `<DecisionHistory />` renders
the full ordered list as a disclosure on the record — not a link to a separate page, because the
requirement is that the answer is in that place (research.md §6).

## API access

Through `app/lib/api/approvals.ts` only (Principle V). Components never call `fetch`. Lists use the
batch state endpoint — **one request per list, not one per row** (backend contract, Part 1).
