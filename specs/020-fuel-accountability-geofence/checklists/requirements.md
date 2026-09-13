# Specification Quality Checklist: fuel accountability geofence (Web)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-13
**Feature**: [spec.md](../spec.md)

## Content Quality

- [X] No implementation details (languages, frameworks, APIs)
- [X] Focused on user value and business needs
- [X] Written for non-technical stakeholders
- [X] All mandatory sections completed

## Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain — **2 open, deliberately**
- [X] Requirements are testable and unambiguous
- [X] Success criteria are measurable
- [X] Success criteria are technology-agnostic
- [X] All acceptance scenarios are defined
- [X] Edge cases are identified
- [X] Scope is clearly bounded
- [X] Dependencies and assumptions identified

## Feature Readiness

- [X] All functional requirements have clear acceptance criteria
- [X] User scenarios cover primary flows
- [X] Feature meets measurable outcomes defined in Success Criteria
- [X] No implementation details leak into specification

## Constitution alignment

- [X] Principle II (no inline styling) — stated as a requirement
- [X] Principle III (centralized constants) — copy required to live in the constants module
- [X] Principle V (API access boundary) — all access via typed API modules
- [X] Principle VI — resolved by constitution v2.1.0 (floor moved 768px → 320px)

## Notes

**Principle VI was amended for this work.** Client Note 25 asked for the admin site to work on
Android and iPhone, which conflicted with a NON-NEGOTIABLE principle. Constitution v2.1.0
(2026-09-13) resolved it by lowering the responsive floor for desktop surfaces from 768px to 320px,
rather than making the application mobile-first — "worked on" is read as reachable, not optimised.
Desktop surfaces are still designed desktop-first and the mobile-critical list is still closed.

Note that no existing screen has ever been checked at 320px, because the previous gate did not
ask. The floor is an obligation the codebase has not been measured against.

The 2 open [NEEDS CLARIFICATION] markers are not oversights. Each names a decision that changes
what gets built and that only the client can make.

No test framework is installed in this repository (`TODO(TESTING_STANDARD)`), so no test-file tasks
may be generated from these specifications. Verification is `npm run lint`, `npx tsc --noEmit`,
`npm run build` and manual passes.
