'use client';

import SectionGuard from '@/app/ui/projects/section-guard';

/**
 * `PROJECT_FINANCIALS` for the billing and summary screens under `portfolio/:id/`.
 *
 * The projects layout's `PROJECTS_PERMISSIONS` map is keyed on the **third** path segment, so it
 * sees `portfolio` for every one of these pages and cannot tell a document tab from a billing sheet.
 * These three screens are money screens — the backend guards their endpoints with
 * `PROJECT_FINANCIALS` — so without this a `PROJECTS` holder would get a page whose every request
 * 403s, which reads as a broken screen rather than as a permission they do not hold.
 *
 * A UX affordance, as every client-side guard in this app is: `buildcore-api` is what actually
 * enforces this. The value of saying it here is that the refusal is legible.
 */
export default function FinancialsGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  // Delegates to `SectionGuard` since 024: 022's daily-work screens need the same guard with a
  // different permission, and two near-identical copies is how one of them stops being maintained.
  // The name stays, because three working screens name it and the refusal it explains is specific.
  return <SectionGuard permission="PROJECT_FINANCIALS">{children}</SectionGuard>;
}
