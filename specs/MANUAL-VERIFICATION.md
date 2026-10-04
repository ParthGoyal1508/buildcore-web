# Manual verification checklist

**90 open tasks across six features, every one of them a pass somebody has to walk.** None is a
piece of building. This is the ordered list, grouped by what each pass *needs* rather than by
which feature it belongs to — because the expensive part is not the looking, it is setting up a
second signed-in user or finding a phone with a poor GPS fix, and doing that once for eleven passes
instead of eleven times is the whole value of this document.

Written 2026-10-04. The authoritative detail for each pass lives in that feature's
`quickstart.md`; this file is the order, the setup, and the task each pass closes.

---

## How to record a result

**Write the result next to the task in the feature's `tasks.md`, not here and not in a terminal.**
Four of these features carry a task that says exactly that — 018 T055, 019 T063, 020 T057, 021 T048
— and each is still open because nothing was recorded. A pass whose result lives only in somebody's
memory is not a pass.

- It worked → change `- [ ]` to `- [X]` and add one line: what you saw, and the date.
- It did not → **leave it open** and add what you saw. A half-working pass recorded as done is
  worse than one recorded as not run.
- A measurement → write **the number**. "Felt fast" is not a figure, and three of these tasks say so.

---

## Session 0 — setup, once

```bash
# 1. Database, migrations and demo data
cd buildcore-api
npm run db:demo              # resets, migrates and seeds. ~2 minutes.

# 2. API on :3000
npm run start:dev

# 3. Interface on :3001, in another terminal
cd ../buildcore-web && npm run dev
```

Then open <http://localhost:3001>.

**Accounts.** Every login is `<first>.<last>@<company-domain>` with password `secret42`.

| Who | Email | Use it for |
|---|---|---|
| Super Admin, both companies | `admin@buildcore.dev` | company switching, settings, approvals as Director |
| Site Admin, Parth Realcon | `rajesh.kulkarni@parthrealcon.com` | the first approver level, site work |
| Site Admin, Shreeji Buildtech | `amit.deshpande@shreejibuildtech.in` | the second company |
| HR, Parth Realcon | `priya.menon@parthrealcon.com` | the HR level of every chain |

**Two things to know before you start, or several passes will confuse you.**

1. **`admin@buildcore.dev` has a company selected.** While a company is selected it behaves as a
   single-company user — that is deliberate, it is what makes the switcher mean anything. If a pass
   says "as Super Admin across both companies", clear the selection in the switcher first.
2. **The demo project's margin is negative.** That is the seeded data, not a defect: the
   subcontract award and the client's quoted percentage genuinely leave it short. Do not spend
   time on it.

**What the seed gives you to look at:** a 12-line two-level BOQ at 2.46%, a subcontract award,
three client bills in three different states (one certified short, one awaiting certification, one
still a draft), three RA bills, a part-released retention ledger, an approved labour payment sheet,
and one BOQ line deliberately left unpriced.

---

## Session 1 — desktop, one user, Chrome

The bulk of it. One browser, one login, no special equipment. Work down the list; it is ordered so
that each pass leaves the data the next one needs.

### Documents and letters — feature 017

| # | Do this | You must see | Closes |
|---|---|---|---|
| 1.1 | Create a project with a mandatory kind unattached | Refused, **naming the missing kind** — not "validation failed" | 017 T033, T080 |
| 1.2 | Attach a kind that expires | It asks for the expiry date **before** letting you submit | 017 T033 |
| 1.3 | Open an Aadhaar document | Download only. No preview, no inline render | 017 T033 |
| 1.4 | Open a work order whose chain is pending | **No Issue button at all.** Then approve as Director and reload: Issue appears | 017 T034 |
| 1.5 | Preview a letter, then issue it | The issued document is the preview, character for character | 017 T035 |
| 1.6 | Make an issue fail (stop the API mid-issue) | Your typed values are still there, the failure is readable, the page did not navigate | 017 T035 |
| 1.7 | Open the project list with 50 projects | **One** readiness request in the Network tab, not fifty | 017 T036 |
| 1.8 | File a document against a kind outside the required eight | It appears under *supplementary*, and the completeness figure does **not** move | 017 T051, T082 |
| 1.9 | Find a required kind with no type defined, use "Define and upload" | The kind becomes uploadable without leaving the screen | 017 T052 |
| 1.10 | In settings: move a kind to Optional, add one, remove one, Save, reload | It stuck. Then switch company and confirm the other company is unaffected | 017 T060 |
| 1.11 | Define a new kind from the project-documents settings screen and require it | Done without leaving for Company Documents | 017 T061 |
| 1.12 | Define a kind, declare its fields, write a template using them, issue a letter | The declared values appear in the rendered letter. **End to end** | 017 T137, T047 |
| 1.13 | As a user who may upload but not change settings | The editor's controls are **absent**, not disabled | 017 T081 |
| 1.14 | As Super Admin, switch company on the documents screen | The list, the completeness count, and a subsequent upload all follow the switch | 017 T050 |

### BOQ, billing and P&L — feature 018

| # | Do this | You must see | Closes |
|---|---|---|---|
| 1.15 | Walk quickstart Scenario 1, including the over-quantity case and both deductions | The figures match the quickstart's stated arithmetic | 018 T009 |
| 1.16 | Enter a client bill down the seeded BOQ and submit it | Cumulative-to-date moves; the draft bill does **not** count toward it | 018 T026, T050 |
| 1.17 | Enter an RA bill against the award and submit | Measured against the subcontractor's rates, not the client's | 018 T026, T050 |
| 1.18 | Open the project summary | Every figure reconciles to its records, and each one **opens** to them | 018 T041, T051 |
| 1.19 | Open the monthly labour view | It answers "what did we pay this worker in September" without opening several screens | 018 T052 |
| 1.20 | Open the group board | Totals only the projects you may see | 018 T046, T053 |

### Access, companies and cash — feature 019

| # | Do this | You must see | Closes |
|---|---|---|---|
| 1.21 | Open React Query Devtools, inspect `['currentUser']` | It carries `grants`, and matches the raw Network response | 019 T011a |
| 1.22 | Sign in as the read-only role and walk **every** module | No write control visible anywhere. Record the 403 replay too | 019 T024, T059 |
| 1.23 | Revoke a permission on a signed-in user, then reload | The change is reflected without clearing anything by hand | 019 T030 |
| 1.24 | Type the URL of a refused route directly | Refused. Then a user with no modules at all: a sensible screen, not a crash | 019 T031 |
| 1.25 | Switch company, then **inspect the cache** | No data from the previous company survives. This is an inspection, not a glance | 019 T046, T061 |
| 1.26 | Create a record after a switch | It belongs to the **selected** company | 019 T057 |
| 1.27 | Switch on cash hiding, then walk every module **and one export** | No cash figure anywhere. Module by module | 019 T054, T060 |
| 1.28 | Record a cash payment with hiding on | Refused, naming the reason — and the refusal is about the permission, not the toggle | 019 T054 |
| 1.29 | Build the Note 22 role: logbook entry, nothing else in machinery | Navigation **and** direct access both honour it | 019 T058 |

### Approvals — feature 016

| # | Do this | You must see | Closes |
|---|---|---|---|
| 1.30 | Open the approvals settings surface | All three states render **distinctly**. Remove payment release, Save, confirm the list says so | 016 T070 |
| 1.31 | As a user without approval-configuration permission | The list is readable and no change control appears anywhere | 016 T071 |
| 1.32 | As an administrator, submit an attendance correction | Admin screen reads *awaiting approval*; the employee's view shows **nothing yet** | 016 T058, T051 |
| 1.33 | Complete the chain, then view the day as the employee | The actor's name, the time, and the before and after are all there | 016 T057 |

### Search, exit and payout — feature 021

| # | Do this | You must see | Closes |
|---|---|---|---|
| 1.34 | Search a code of each supported kind | Each reaches its record | 021 T014, T041 |
| 1.35 | Search a name fragment with no code | Reaches the project. Then confirm name matching in **all four** registers | 021 T042 |
| 1.36 | Walk the exit clearance: an outstanding item, then settle | Settlement refused while anything is outstanding, naming each item | 021 T027, T043 |
| 1.37 | Check the assets on the clearance **and** on the settlement summary | Every asset held at exit appears on both, with its outcome | 021 T044 |
| 1.38 | Propose a waiver, approve it, settle. Then propose, reject, retry | Approved unblocks; rejected stays blocked | 021 T054 |
| 1.39 | Walk quickstart Scenario 3 (slip delivery) | An unapproved run refuses delivery; approving permits it | 021 T035 |
| 1.40 | Download the bank transfer sheet for the seeded approved run — quickstart Scenario 4 | Opens in a spreadsheet, and every row names the company's debit account. The seed provides the run; the account is on the company | 021 T040 |

### Fuel and geo-fencing — feature 020

| # | Do this | You must see | Closes |
|---|---|---|---|
| 1.41 | Punch in and read the **request body** in the Network tab | The accuracy key is there with a plausible value. A 201 proves nothing | 020 T006 |
| 1.42 | Walk quickstart Scenario 2 in full, including step 4's muster | As stated in the quickstart | 020 T013 |
| 1.43 | Walk Scenario 4: a refused attempt | The day shows **no punch**, and the attempt is findable | 020 T028, T053, T054 |
| 1.44 | Walk Scenario 5: location assignment | An employee's assigned location **and its history** are visible | 020 T037, T052 |
| 1.45 | Walk Scenario 6: fuel exception review with the seeded entries | A reviewer raises a hire deduction and an operator recovery | 020 T048, T051 |
| 1.46 | The same with and without the permission, desktop | The with-permission case matters as much as the without | 019 T067 |

---

## Session 2 — 320px, one sweep

**Do this as one pass over every screen, not per feature.** Chrome DevTools, device toolbar, width
**320**. The constitution makes this a gate, not a polish pass — 020 T055 says it is the most
important one in that feature.

Measure, do not eyeball: `window.scrollTo(2000, 0)` then read `window.scrollX`. **Zero or it
failed.** Horizontal scroll inside a table's own container is fine; the page body scrolling
sideways is not.

| # | Screens | Closes |
|---|---|---|
| 2.1 | Every punch surface — the gate of gates | 020 T007, T014, T024, T029, T055 |
| 2.2 | Both billing sheets: grid scrolls in its own container, totals still reachable | 018 T049 |
| 2.3 | Every documents and letters surface | 017 T037 |
| 2.4 | The company switcher, with the longest company name — reachable, operable, not covering the page | 019 T055 |
| 2.5 | Dashboard search, including keyboard selection | 021 T016, T046 |
| 2.6 | The attendance view and the correction screen | 016 T049, T113 |
| 2.7 | The role access-level editor | 019 T067 |
| 2.8 | **Keyboard operability** on all of the above, at both widths — Principle VI scopes this to every screen regardless of viewport, and a touch-target pass does not cover it | 016 T114 |

---

## Session 3 — two users at once

Two browser profiles, or one normal window and one incognito. Sign in as two different people and
keep both open.

| # | Do this | You must see | Closes |
|---|---|---|---|
| 3.1 | Both users on the same bill; one submits | The other is told, and does not overwrite | 018 T030 |
| 3.2 | The group board, as two viewers with different project access | Each total covers only what that viewer may see | 018 T053 |
| 3.3 | **The disclosure test.** Search the same term as both users, side by side | A record one may not see is never revealed — not by result, not by a group header, not by a count, not by an empty state that differs | 021 T015 |

3.3 is the one that matters. It is the only pass here that can fail in a way nobody would notice.

---

## Session 4 — the measurements

Write down numbers. Every task in this section is still open because no figure was taken.

| # | Measure | Budget | Closes |
|---|---|---|---|
| 4.1 | 500-line billing sheet interactive, and typing down a column (React Profiler) | under 3s, lag-free | 018 T018, T047 |
| 4.2 | The same against the client's real file — 312 lines | under 3s | 018 T067 |
| 4.3 | Project summary for 12 months | under 3s | 018 T048 |
| 4.4 | Company switch to usable, **including the cache clear** — `clear()` costs visible time | under 2s | 019 T056 |
| 4.5 | Search responds as you type, without a request per keystroke | count the requests | 021 T045 |
| 4.6 | Kill the tab mid-entry, and drop the network mid-save | nothing lost | 018 T023 |

---

## Session 5 — a real phone

Needs hardware. Both items need a device, not an emulator.

| # | Do this | Closes |
|---|---|---|
| 5.1 | Punch from a device with a **poor GPS fix** — quickstart Scenario 3, including inside-the-fence-but-inaccurate | 020 T023 |
| 5.2 | A refusal reaches the worker within 2 seconds of the attempt, with the refusal switched on | 020 T050 |
| 5.3 | Repeat 017 passes 1.4 and 1.6 in **Safari/WebKit** | 017 T038 |

---

## Session 6 — not walkable yet, and why

Listed so nobody spends an afternoon discovering it.

- **020 T053 (part), T050** need the hard geofence refusal **switched on for a company**, and it is
  deliberately off everywhere. Do not switch it on before the client has seen the refusal rate —
  that is 020 T016, and it is the reason the switch is off.
- **020 T007b** — the refusal rate, when it is measured, **understates**. A very poor GPS fix is
  rejected on the phone before it reaches the server, and those are the punches most likely to have
  been refused. Say so alongside the figure; do not present it as a complete count.
- **020 T007a** is a defect, not a pass: a Super Admin can raise the per-company GPS tolerance
  above 100m and it does nothing, because the phone's own gate refuses first. Closing it needs a
  server read that does not exist yet. One decision from the client: is a tolerance above 100m
  something they want?
- **021 T013e** — a search result for an employee or a vendor reaches a screen that does not exist
  yet. Not this feature's work, and not a failing pass.
- **018 T052** needs seeded payment sheets. The demo seed now carries one; if the monthly labour
  view is empty, reseed before concluding anything.

---

## What none of these passes can cover

Said here because it is the honest boundary of this document.

- **Load.** 100–150 concurrent users at attendance time is a claim about a deployed system. Nothing
  is deployed, and a load test against a laptop measures the laptop.
- **The geo-fence refusal rate.** It needs real punches from real workers. Seeded attendance cannot
  answer it, and a figure from invented data would be more dangerous than no figure.
- **Whether the mandatory-document set is the right set.** These passes prove the rule works. Only
  the client knows whether the four kinds are the four they meant.
