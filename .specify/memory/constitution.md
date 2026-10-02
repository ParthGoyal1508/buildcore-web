<!--
Sync Impact Report (v2.2.0, 2026-10-02)
- Version change: 2.1.0 → 2.2.0
- Modified principles:
  - VI. Responsive Design: Desktop-First, Mobile-Critical Surfaces (NON-NEGOTIABLE). Two surfaces
    are added to the mobile-critical list: **the approvals queue**, and **site attendance review and
    correction**. MINOR, not MAJOR: the article is not redefined, the default stays desktop-first,
    the list stays closed, and every rule attaching to the list applies to the two additions
    unchanged. What is materially expanded is the list itself, which this principle's own "Changing
    the list" clause requires an amendment to do — so this is that amendment.
    Rationale: client review item 22 asks that the whole admin portal work on Android and iOS. Read
    literally that is mobile-first everywhere, which would reverse the v2.0.0 finding this document
    exists to record. Put to the client on 2026-10-02 with that cost stated; they chose to keep
    desktop-first and name the screens that genuinely need a phone. These two were named. Plant
    logbook, fuel entry, material indents and inventory issue were offered and not chosen, so they
    keep the 320px breakage floor and nothing stronger.
    Each addition is justified by who must use it away from a desk, not by how it looks: a Director
    deciding a payment release, and a supervisor correcting a day the punch refusal turned away.
- Templates requiring no change: plan, spec, tasks and checklist templates reference Principle VI
  by name rather than restating its list.
- Follow-up: the two added surfaces are not yet built to the mobile-critical standard. Until they
  are, this amendment records an obligation rather than a fact, and feature 016's task list carries
  the work.

Previous report (v2.1.0) follows.

- Version change: 2.0.0 → 2.1.0
- Modified principles:
  - VI. Responsive Design: Desktop-First, Mobile-Critical Surfaces (NON-NEGOTIABLE). The
    responsive floor for desktop surfaces moves from 768px (tablet) to 320px (phone). MINOR, not
    MAJOR: the article is not redefined and its default is unchanged — desktop surfaces are still
    *designed* desktop-first, the mobile-critical list is still closed, and none of the one-handed,
    44px or hover-gating rules extend beyond it. What is materially expanded is the breakage floor
    every other screen must clear.
    Rationale: the client requires that the administrative application be reachable from Android
    and iOS phones ("All the Admin website has also worked on Mobile Phone also of Android and
    Iphone", client notes item 25). Read literally as mobile-first everywhere, that would reverse
    the v2.0.0 finding this constitution was amended to record — that designing dense back-office
    screens phone-first imposes a card-layout tax on data that reads better as a table. Read as
    *reachability*, which is what "worked on" asks for, it is satisfied by lowering the floor. That
    is the reading adopted, deliberately and with the client's agreement, because it meets the
    requirement without re-adopting a position already found to be wrong.
    Cost: a responsive pass per admin screen, mostly moving wide content into `overflow-x: auto`
    containers. Not a redesign.
- Modified sections:
  - Development Workflow & Quality Gates: the pre-merge check for non-mobile-critical screens moves
    from 768px to 320px, for breakage only. The wording now says explicitly that a table scrolling
    inside its own container passes and one that pushes the page body sideways does not, because
    that was the recurring ambiguity in the 768px form of the gate.
- Added sections: none
- Removed sections: none
- Templates requiring update: none. `plan-template.md`'s Constitution Check table references the
  principle by name, which is unchanged.
- Follow-up: no existing screen is known to meet the new floor, because none has been checked at
  320px — the previous gate did not ask. This amendment therefore describes an obligation the
  codebase has not yet been measured against, and the gap should be treated as a backlog of
  responsive passes rather than as a claim that the product already complies.
- Previous amendment (v2.0.0, for reference, unchanged):
- Modified principles:
  - VI. Responsive & Mobile-First Design (NON-NEGOTIABLE) → VI. Responsive Design: Desktop-First,
    Mobile-Critical Surfaces (NON-NEGOTIABLE). REDEFINED, hence the MAJOR bump. The v1.1.0 article
    asserted that BuildCore's primary users are field staff on phones and therefore made
    mobile-first binding on *every* screen. That is now known to be wrong about most of the
    product: only a small, closed set of surfaces — punch in/out, attendance viewing, and leave —
    is actually operated on a phone. The overwhelming majority of the application (HR
    administration, payroll, masters, projects, inventory, dashboards, reports, registers) is
    operated by back-office staff on desktops, and designing those screens phone-first was
    imposing a card-layout tax on dense tabular data that reads better as a table.
    The new article inverts the default (desktop-first) while making the mobile-critical list
    binding and closed — adding to it requires its own amendment.
- Modified sections:
  - Development Workflow & Quality Gates: the blanket "every new/changed screen MUST be manually
    checked at a mobile viewport" gate is split — mobile-critical surfaces are verified at 320px,
    every other screen is verified at desktop and at a 768px tablet width for breakage only.
- Added sections: none
- Removed sections: none
- Previous amendment (v1.2.0, for reference, unchanged):
  - Technology Stack & Standards: pre-approved `recharts` as this project's charting library, per
    the user's explicit choice when asked — the Machinery feature's Equipment Utilization Report
    (a horizontal stacked-bar band distribution) is the first consumer; no chart-like visual
    existed anywhere in `buildcore-web` before this.
- Deferred / TODO items (carried over, unchanged):
  - TODO(TESTING_STANDARD): No test framework is installed yet (no Jest/Vitest/Playwright in
    package.json). Section "Development Workflow & Quality Gates" records this as a known gap
    rather than inventing an unused policy; adopt a framework and amend this constitution (MINOR
    bump) once introduced.
  - TODO(CODE_REVIEW_PROCESS): No formal reviewer/approval policy was supplied. A baseline
    "at least one review before merge" rule is recorded below; tighten it (e.g. required
    reviewers, CODEOWNERS) via amendment if the team adopts something stricter.
-->

# BuildCore Web Constitution

## Core Principles

### I. Component-Based Architecture
Every UI element MUST be a small, single-purpose React component colocated under `app/` following
Next.js App Router conventions (route segments own their `page.tsx`/`layout.tsx`; shared/reusable
pieces live under `app/ui/`, grouped by feature or domain — e.g. `app/ui/dashboard/`). Components
MUST default to Server Components; a component is marked `"use client"` only when it needs
interactivity, browser APIs, or React hooks that require the client runtime, and that boundary
MUST be pushed as far down the tree as possible. Business/data logic (API calls, data shaping)
MUST live in `app/lib/`, not inline inside component bodies — components render, `lib` computes.

**Rationale**: App Router's server/client split is a performance and security boundary, not a
style choice; keeping logic out of components keeps both testable and keeps client bundles small.

### II. No Inline Styling (NON-NEGOTIABLE)
Components MUST NOT use the inline `style={}` prop or hardcoded inline CSS. All styling MUST be
expressed through Tailwind utility classes (per `tailwind.config.ts`) or, for styles Tailwind
cannot express (e.g. `@font-face`, complex keyframes), through the project's global stylesheet
(`app/ui/global.css`). Conditional/dynamic class composition MUST use the existing `clsx` utility
rather than string concatenation or inline style objects. The only narrow exception is a numeric
value that is genuinely computed at runtime from data (e.g. a chart bar's pixel height) and cannot
be expressed as a class — such cases MUST be isolated to a single, clearly-named line and MUST NOT
be used to smuggle in general-purpose styling.

**Rationale**: Inline styles bypass Tailwind's design tokens, break dark-mode/theming
consistency, cannot be purged/optimized, and are invisible to linting — they silently fragment the
design system.

### III. Centralized Constants & Configuration (NON-NEGOTIABLE)
Components and modules MUST NOT hardcode literal strings, URLs, magic numbers, or user-facing copy
directly inline. Such values MUST be sourced from a centralized location:
- Cross-cutting constants (routes, limits, magic numbers, shared labels) MUST live in a dedicated
  `app/lib/constants.ts` (or a `constants/` module if the set grows large enough to split by
  domain).
- Environment-dependent values (API base URLs, feature flags, secrets) MUST come from environment
  variables surfaced through `app/lib/config.ts` (or equivalent), never read as a raw
  `process.env.X` scattered across components, and never hardcoded as a literal URL/string in a
  component.
- User-facing copy that is domain content (not a one-off developer-facing label) MUST be sourced
  from a constants/content module so copy changes do not require hunting through JSX.
A code review MUST reject a new literal (string, URL, or magic number) introduced directly in a
component or route handler when a constants/config module is the appropriate home for it.

**Rationale**: Scattered literals are the single biggest cause of drift between environments
(dev/staging/prod), duplicated/inconsistent copy, and error-prone renames; centralizing them makes
the codebase greppable and safely refactorable.

### IV. Type Safety & Validation
TypeScript `strict` mode (already enabled in `tsconfig.json`) MUST remain on and MUST NOT be
weakened with `any`, `@ts-ignore`, or non-null assertions used to silence real type errors. Any
data crossing a trust boundary — API responses from `buildcore-api`, form input, environment
variables — MUST be validated at runtime with a `zod` schema before the application trusts its
shape; the inferred `z.infer` type, not a hand-written duplicate interface, MUST be used downstream.

**Rationale**: `strict` TypeScript catches internal mistakes at compile time; `zod` at the
boundary catches the mistakes TypeScript cannot see — a backend contract change or a malformed
response.

### V. API Access Boundary (NON-NEGOTIABLE)
This application MUST NOT access a database directly and MUST NOT embed raw SQL or an ORM. All
data access MUST go through `buildcore-api` via the typed fetch wrapper in `app/lib/api/`
(`client.ts` and per-domain modules such as `auth.ts`). New backend calls MUST be added as a typed
function in `app/lib/api/`, not as an ad-hoc `fetch()` call inside a component.

**Rationale**: This is an explicit architectural decision recorded in the project README — the
direct-Postgres demo plumbing from the original course starter was deliberately removed. Keeping a
single API boundary is what makes the documented token-handling and backend-contract work
(HLD §9.1) tractable.

### VI. Responsive Design: Desktop-First, Mobile-Critical Surfaces (NON-NEGOTIABLE)
BuildCore is a desktop application with a small, deliberately-scoped mobile footprint. The default
design target for every screen is the desktop viewport; a closed list of field-facing surfaces is
the exception and MUST be designed phone-first.

**Mobile-critical surfaces (the closed list).** These are operated one-handed, on site, on a phone,
and MUST be built mobile-first — base Tailwind classes target the smallest viewport, with
`sm:`/`md:`/`lg:`/`xl:` variants layering on larger-viewport adjustments:
- **Punch in / punch out**, including the camera + GPS capture flow and its offline queue.
- **Attendance** — an employee's own attendance history/calendar and its status detail, and the
  supervisor's on-site muster/attendance-marking screen (feature 013), which is attendance capture
  in the field by another name.
- **Leave** — applying, viewing balances and application status, and a manager's approve/reject
  action on a pending application.
- **Sign-in**, as the entry point to all of the above. It is listed not because it is field work in
  itself but because a field user cannot punch without passing through it; a desktop-only login
  would make the rest of this list unreachable.
- **The approvals queue** — reading a pending item, and approving, rejecting or returning it.
  *(Added v2.2.0.)* Listed because of who has to use it rather than where it is used: features 016
  and 021 put a Director in the path of every payment release, payroll run and final settlement, and
  a Director who can only decide at a desk is the reason items sit for days. The observed failure of
  an approval gate is not that somebody rejects wrongly, it is that nobody acts and the gate gets
  bypassed by sharing an account.
- **Site attendance review and correction** — reading a day's attendance for a site and raising a
  correction for it. *(Added v2.2.0.)* The counterpart to feature 020's punch refusal: a refused
  punch records nothing at all, and the only route back is a correction raised by the supervisor —
  who is standing on a site, not sitting at a desk. Listing the refusal without listing its remedy
  would leave a worker's day recoverable only by someone who has gone back to the office.

The **My Workspace shell** (feature 003) that hosts the employee-facing entries above stays
mobile-first in its entirety, including the screens in it that are not themselves on this list
(salary-slip view/download, reimbursement requests). Splitting one shell across two design targets
would cost more than it saves, and those screens are already built that way.

On these surfaces: interactive elements MUST have a minimum 44×44px touch target; primary actions
MUST be reachable one-handed; no action may be gated behind a hover-only interaction (hover MAY
enhance, never gate); and the layout MUST NOT break between 320px and 428px. Each MUST be checked
at a 320px viewport before merge.

**Desktop surfaces (everything else).** HR administration, payroll, masters, projects, inventory,
dashboards, reports and registers are operated at a desk. These MUST be designed at desktop width
first, and MUST additionally remain *usable and unbroken* down to **320px**: no content clipped, no
control unreachable, and the page body MUST NOT scroll horizontally — wide content (tables, boards,
wide forms) scrolls inside its own `overflow-x: auto` container instead. A card-layout phone
fallback (the established `ResponsiveList` pattern) is OPTIONAL on these surfaces and MUST NOT be
treated as a blanket requirement: for a dense back-office grid, a horizontally-scrolling table in
its own container is an acceptable and frequently better answer than forcing twenty columns into
stacked cards.

**The distinction between the two lists is design target, not reachability.** A desktop surface is
*designed* for a desk and *reachable* from a phone. It is not required to be comfortable there, to
be one-handed, or to meet the 44px target rule — those remain obligations of the mobile-critical
list alone. What it may not be is broken: a back-office user who opens a register on their phone to
check one figure must be able to read it, not meet a layout that has collapsed. This is the floor,
and it is deliberately low; meeting it is usually a matter of putting wide content in its own
scroll container rather than redesigning anything.

**Not scoped by viewport.** Keyboard operability applies everywhere: every interactive control on
every screen, mobile-critical or desktop, MUST be reachable and operable by keyboard. Likewise,
"desktop-first" is never a licence to ship a screen that is outright broken on a phone — a desktop
surface opened on a phone must degrade to something legible and operable, it simply is not
optimised for that viewport.

**Changing the list.** Adding a surface to (or removing one from) the mobile-critical list above
requires a constitution amendment. A feature spec MUST NOT unilaterally declare a new screen
mobile-critical; it may only note that an existing listed surface is in its scope.

**Rationale**: The v1.1.0 form of this principle assumed BuildCore's primary users are field staff
on phones. That is true only of punching, attendance and leave. Everyone else — HR, payroll,
accounts, procurement, project management — works on a desktop with dense tabular data, and
mobile-first was making those screens worse: card layouts that hide the column comparisons the
work depends on, and a design pass spent on a viewport those users never open. Scoping the mobile
mandate to the surfaces that genuinely need it keeps the PWA (`@serwist/next`) valuable where it
matters, without taxing the 90% of the product that does not.

## Technology Stack & Standards

- **Framework**: Next.js (App Router) on React 19, TypeScript 5 in `strict` mode.
- **Styling**: Tailwind CSS via `tailwind.config.ts` and `@tailwindcss/forms`; no CSS-in-JS
  library is in use, and none should be introduced without a constitution amendment.
- **Forms & validation**: `react-hook-form` paired with `@hookform/resolvers` and `zod` schemas
  for all forms; new forms MUST follow this same pattern rather than uncontrolled inputs or manual
  validation.
- **Class composition**: `clsx` for conditional Tailwind class strings.
- **Linting**: `next lint` (ESLint via Next.js' built-in config) MUST pass with no errors before
  merge.
- Dependencies referenced in `README.md` as "not here yet" (`shadcn/ui`, `@tanstack/react-query`,
  `zustand`, `@serwist/next`, `lucide-react`, generated OpenAPI types) are pre-approved additions
  when the feature that needs them lands; adding a *different* new architectural dependency (a
  second styling system, a second HTTP client, a second form library) requires a constitution
  amendment first.
- **Charting**: `recharts` is pre-approved for any screen that needs a data visualization (chart,
  graph, proportional/stacked bar) beyond what a plain styled element can express. A second,
  materially different charting mechanism (a canvas-based library, a hosted charting service)
  still requires its own amendment before introduction.

## Development Workflow & Quality Gates

- Every change MUST pass `npm run lint` and a TypeScript build/typecheck (`next build` or
  equivalent `tsc --noEmit`) before merge.
- Every change MUST be reviewed by at least one other person before merging to the main branch;
  a reviewer MUST explicitly check for violations of Principles II, III, V, and VI (inline styles,
  hardcoded literals, direct data access, and responsiveness scoped to the wrong target) since
  these are the non-negotiable articles most likely to be introduced accidentally.
- New/changed screens MUST be manually checked before merge at the viewport Principle VI assigns
  them (browser dev tools device emulation, minimum):
  - a **mobile-critical** surface (punch, attendance viewing, leave, sign-in, the approvals queue,
    site attendance review and correction) at 320px, and again at desktop;
  - every **other** screen at desktop, and again at 320px for breakage only — this check is
    looking for clipped content, unreachable controls and a horizontally-scrolling page body, not
    for a phone-optimised layout. A dense table that scrolls sideways inside its own container
    passes; one that pushes the page body sideways does not.
  Until an automated test framework is adopted (see Known gap below), this is a manual review
  step, not an automated gate.
- **Known gap**: no automated test framework is installed yet (see Sync Impact Report). Until one
  is adopted, reviewers substitute manual verification (running the affected page/flow locally)
  for automated test coverage. Introducing a test framework (e.g. Vitest, Playwright) requires
  only a MINOR constitution amendment to record the resulting standard, not a MAJOR one.

## Governance

This constitution supersedes ad-hoc conventions for anything it explicitly covers. Amendments
require:
1. A documented rationale for the change (what problem it solves or what it corrects).
2. A version bump per semantic versioning: MAJOR for removing/redefining a principle, MINOR for
   adding a principle or materially expanding guidance, PATCH for wording/clarification fixes.
3. Updating the Sync Impact Report at the top of this file.

All pull requests MUST be checked against this constitution as part of review (see Development
Workflow & Quality Gates); a reviewer who approves a change that knowingly violates a
NON-NEGOTIABLE principle MUST record the justification in the PR description, and that
justification MUST itself prompt a constitution amendment if the exception is expected to recur.

**Version**: 2.2.0 | **Ratified**: 2026-08-26 | **Last Amended**: 2026-10-02
