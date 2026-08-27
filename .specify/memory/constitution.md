<!--
Sync Impact Report
- Version change: 1.1.0 → 1.2.0
- Modified principles: n/a
- Added sections:
  - Technology Stack & Standards: pre-approved `recharts` as this project's charting library, per
    the user's explicit choice when asked — the Machinery feature's Equipment Utilization Report
    (a horizontal stacked-bar band distribution) is the first consumer; no chart-like visual
    existed anywhere in `buildcore-web` before this.
- Previous amendment (v1.1.0, for reference, unchanged):
  - Core Principles: VI. Responsive & Mobile-First Design (NON-NEGOTIABLE) — the product ships as
    a PWA (`@serwist/next`, already pre-approved in Technology Stack) whose primary users
    (site-level staff) are expected to be on phones/tablets in the field, so this was promoted to
    a NON-NEGOTIABLE principle rather than left as an unstated assumption.
- Removed sections: none
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

### VI. Responsive & Mobile-First Design (NON-NEGOTIABLE)
Every screen and component MUST render correctly across mobile, tablet, and desktop viewports,
built mobile-first: base Tailwind classes target the smallest viewport, with `sm:`/`md:`/`lg:`/
`xl:` variants layering on larger-viewport adjustments — never the reverse (a desktop layout with
mobile treated as an override). Interactive elements MUST have a minimum 44×44px touch target.
Layouts MUST NOT depend on fixed pixel widths that break below common mobile widths (320–428px),
and no action MUST be reachable only via a hover-only interaction (hover MAY enhance, never gate).
This application is the client for BuildCore's PWA (`@serwist/next`, already listed as a
pre-approved "not here yet" dependency in Technology Stack) — every new screen MUST be checked at a
mobile viewport before merge, not retrofitted afterward.

**Rationale**: BuildCore ships as a PWA whose primary users on several roles (Site Engineer, Site
User, and other field-facing roles) are expected to use it on phones/tablets on site, not desktops
in an office — a desktop-first design would fail its actual primary audience, not merely degrade
gracefully for a secondary one.

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
  hardcoded literals, direct data access, non-responsive/desktop-only layouts) since these are the
  non-negotiable articles most likely to be introduced accidentally.
- New/changed screens MUST be manually checked at a mobile viewport (browser dev tools device
  emulation, minimum) before merge, per Principle VI — until an automated test framework is
  adopted (see Known gap below), this is a manual review step, not an automated gate.
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

**Version**: 1.2.0 | **Ratified**: 2026-08-26 | **Last Amended**: 2026-08-27
