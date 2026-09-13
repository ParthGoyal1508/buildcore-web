# Specification Quality Checklist: approval spine (Web)

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
- [ ] **Principle VI (desktop-first, mobile-critical closed list) — see note below**

## Notes

**Principle VI is unresolved across all six web specs.** Client Note 25 asks for the whole admin
site to work on Android and iPhone. Principle VI is NON-NEGOTIABLE, defines mobile-critical
surfaces as a closed list (punch, attendance viewing, leave), and was narrowed to that position
deliberately in a MAJOR version bump on the finding that mobile-first was "wrong about most of the
product". These specifications do not resolve that conflict, because a feature specification cannot
amend the constitution. It is recorded in `016-approval-spine` and must be settled before any of
these features is planned.

The 2 open [NEEDS CLARIFICATION] markers are not oversights. Each names a decision that changes
what gets built and that only the client can make.

No test framework is installed in this repository (`TODO(TESTING_STANDARD)`), so no test-file tasks
may be generated from these specifications. Verification is `npm run lint`, `npx tsc --noEmit`,
`npm run build` and manual passes.
