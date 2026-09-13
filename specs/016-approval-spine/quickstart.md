# Quickstart: Approval Spine (Web)

**Feature**: 016-approval-spine

No test framework is installed (constitution `TODO(TESTING_STANDARD)`), so every pass below is
manual and every one is worth doing. Passes 2 and 3 are the ones that catch what nothing else will.

## Prerequisites

```bash
cd /Users/parthgoyal/Projects/buildcore-api && npm run start:dev   # API on :3000
npm run dev         # web on :3001
```

`.env.local` needs `API_ORIGIN=http://localhost:3000`. The API needs `REFRESH_COOKIE_PATH=/bff/auth`
and, for the Safari pass, `REFRESH_COOKIE_SECURE=false`.

Sign in as `admin@buildcore.dev` / `secret42`.

## Pass 1 — The control appears, identically, in every migrated module

Open a reviewable item in each migrated module. Confirm the control is in the same position, offers
the same three actions, and reads the same way. Differences here are the failure this feature exists
to prevent, so look for them rather than past them.

## Pass 2 — The three inert states say three different things

**The pass most likely to be skipped and most likely to matter.**

1. As Super Admin, approve an item at level 1.
2. Let it reach a level Super Admin also holds.
3. Open it.

It must read **"You approved this at {level}"** — not "you do not have permission". A Super Admin
told they lack permission will go and change permissions, which cannot help and may do harm
(research.md §2).

Then unmap a slot in settings and open an item at that level: the control must name the settings
screen, not apologise.

## Pass 3 — A failed decision loses nothing

1. Type a long rejection reason.
2. Kill the API (`kill $(lsof -ti:3000)`).
3. Submit.

The failure must be visible, the reason must still be in the box, and the screen must not have
navigated anywhere. Restart the API and retry without retyping.

## Pass 4 — Double submission is impossible

Click Approve repeatedly. Exactly one request leaves (check Network). The control shows progress
throughout.

## Pass 5 — The queue and the badge agree

1. Note the badge count.
2. Open the queue — same number of items.
3. Approve one from the queue; it leaves the list and the badge decrements, with no manual refresh.
4. In another browser, decide a third item; return to the first and focus the window — the queue
   reflects it.

## Pass 6 — The queue never shows unactionable work

As a user who already decided on an item at level 1, confirm it does **not** appear in their queue
when it reaches a level they also hold. A queue listing work you are forbidden to action trains
people to ignore the queue.

## Pass 7 — No role name is invented by this application

Grep for hardcoded role names in approval surfaces:

```bash
grep -rn "Super Admin\|HO User\|Site Admin\|'HR'" app/ui/ app/lib/api/approvals.ts
```

Expect nothing. Level labels come from the server, because the two companies may map the same slot
differently (research.md §3).

## Pass 8 — One request per list, not one per row

Open a list of 50 items carrying approval state. In Network, confirm **one** approval-state request.
This is the mistake the batch contract exists to prevent.

## Pass 9 — 320px, per constitution v2.1.0

Every approval surface at 320px: nothing clipped, no control unreachable, **the page body does not
scroll horizontally** (a table scrolling inside its own container is correct; one pushing the body
sideways is not). The actor must remain discoverable in dense tables — attribution truncated away
entirely fails the requirement at the width where it is most likely to be read in a hurry.

These screens are desktop-designed and need not be comfortable on a phone. They must not be broken.

## Pass 10 — Safari

Repeat Passes 1, 3 and 5 in Safari. It is where session and cookie behaviour differs most, and this
product has been bitten there before.

## Verification gates

```bash
npx tsc --noEmit
npm run lint            # expect 0 errors (2 pre-existing warnings)
npm run build
```

Prettier is **not** safe to run repo-wide here.

## What these passes cannot cover

No automated test exists for any of the above, so every one is a human remembering to do it. The two
that would hurt most if skipped are **Pass 2** (an inert control that lies about why) and **Pass 8**
(an N+1 that will not be noticed until a list gets long in production).
