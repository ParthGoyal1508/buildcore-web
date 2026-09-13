# Research: Approval Spine (Web)

**Feature**: 016-approval-spine | **Date**: 2026-09-13

Six decisions. The recurring theme is that this feature's value is *sameness*, and sameness is an
architectural property, not a styling one.

---

## 1. One component, or a pattern each module follows

**Decision**: One shared `<ActionReview>` component in `app/ui/`, configured per module. Not a
pattern, not a base class, not a convention.

**Why.** The requirement is that a reviewer learns the control once (spec FR-001, client Note 6:
"at all Places"). A documented pattern drifts — this codebase already has a worked example, where
`StatusBadge` was moved to `app/ui/status-badge.tsx` during feature 004 precisely because three
feature-008 call sites had grown their own variants. Sameness that depends on developers remembering
is sameness with a half-life.

**Consequence**: the component must accept enough configuration to serve attendance exceptions,
payroll runs, indents and RA bills without any of them needing to fork it. That is the hard part of
the design, and it is why attendance exceptions goes first (spec Clarifications) — the smallest real
consumer settles the shape before five more depend on it.

---

## 2. Why an inert control needs three reasons, not one

**Decision**: The control distinguishes *awaiting someone else*, *you already decided*, and
*insufficient authority* — and never collapses them into "no permission".

**Why this is not a nicety.** The backend forbids one person deciding twice on the same item
(backend FR-021a). Super Admin holds every permission, so a Super Admin will routinely meet items
they *could* act on by permission but *may not* act on by rule. Telling them "you do not have
permission" is untrue, and it sends the one person who can change permissions to go and change
permissions — which will not help and may do harm.

The backend supplies the distinction as a code (`APPROVAL_ALREADY_DECIDED` vs
`APPROVAL_NOT_AUTHORISED` vs `APPROVAL_SLOT_UNMAPPED`). This application branches on the code, never
the message — the contract feature 015 established with `SESSION_EXPIRED` and `PASSWORD_CHANGE_REQUIRED`.

`APPROVAL_SLOT_UNMAPPED` deserves its own treatment: it is a configuration fault, and the useful
message names the settings screen rather than apologising.

---

## 3. Never render a role name this application chose

**Decision**: Waiting-on text uses the person's name or the slot label the backend supplies. This
application has no table of role names.

**Why.** Chain levels resolve through configurable role slots (backend research §2), and the client
runs two companies that may map the same slot differently. Any role name hardcoded here would be
right for one company and wrong for the other — and wrong silently, since it would still render.

---

## 4. The queue, the badge, and not polling the world

**Decision**: `GET /approvals/queue/count` backs the navigation badge; the queue list is fetched only
when the queue is opened. The badge reuses the existing reminder-badge mechanism rather than adding a
second one.

**Why separate endpoints.** The badge appears on every screen. Backing it with the full queue would
pull every pending item's subject and requester on every navigation, for a number.

**Freshness**: react-query invalidation on a successful decision, plus refetch on window focus. Not
a websocket and not a short poll — the cost of a stale badge for a few seconds is low, and this
product has no realtime infrastructure to justify introducing for it.

---

## 5. Optimistic or not

**Decision**: **Not optimistic.** The control shows in-flight state and waits for the server.

**Why.** An approval that appears to succeed and then silently reverts is worse than one that takes
a second. The backend has five distinct refusal codes, at least two of which (`ALREADY_DECIDED`,
`SLOT_UNMAPPED`) are not predictable from what this application knows — so an optimistic update would
be guessing at an outcome it cannot compute, and would be wrong in exactly the cases that matter.

Related: spec FR-006 requires the typed reason to survive a failed submission. Losing a paragraph of
justification to a dropped connection is the kind of thing that stops people using a system, and
feature 015 already established that a network failure must not discard what the user was doing.

---

## 6. Where attribution goes on dense tables

**Decision**: Latest action, actor and time render inline on detail views, and as a compact
actor-plus-time cell in tables. Full history is a disclosure, not a separate page.

**Why not a separate page.** The requirement is that the answer is *on the record* (client Note 5:
"us jagah show kare" — in that place). A link to a log elsewhere is what the product already has via
`/dashboard/activity-log`, and it is not what was asked for.

**At 320px**: under constitution v2.1.0 these admin screens must be usable and unbroken at phone
width, though they remain designed desktop-first. For dense tables that means the existing
`ResponsiveList` card fallback or an `overflow-x` container — and the actor must survive whichever is
chosen, because attribution truncated away entirely fails the requirement at the width where it is
most likely to be read in a hurry.
