'use client';

import SubjectLettersPanel from '@/app/ui/letters/letters-panel';

/**
 * The letters a project issues (025 FR-033).
 *
 * ## What was missing, exactly
 *
 * The letters module has permitted `letter_work_order`, `letter_loi` and
 * `letter_purchase_order` since feature 017, each mapped to `PROJECT_FINANCIALS` rather than
 * `PROJECTS` — because issuing a work order is a spending decision. Templates, signatories,
 * versioning and countersigned uploads were all built. **Nothing anywhere called `composeLetter`**,
 * so none of it could be reached, and the only letters surface in the application was recruitment's,
 * which uses a different and older API.
 *
 * ## Purchase orders are no longer offered here (2026-10-15)
 *
 * The client: "Purchase Order is not project specific — it's generic in nature." A PO buys
 * materials for the company, from the item master, and is issued from Inventory → Purchase Orders
 * addressed to the vendor. A PO raised here before that still lists here — it went out on this
 * project and that is where somebody will look for it.
 *
 * The LOI and work order are usually issued from the work order's own record (Subcontractors), which
 * fills them from the finalised rates; those letters address the project too, so they list here.
 * Composing one from this tab directly is still possible, for a letter with no record behind it.
 *
 * The list, the composer and the approval are `letters-panel.tsx`, shared with those two screens.
 */
const PROJECT_KINDS = ['letter_loi', 'letter_work_order'] as const;

export default function ProjectLetters({ projectId }: { projectId: string }) {
  return (
    <SubjectLettersPanel
      subjectType="project"
      subjectId={projectId}
      projectId={projectId}
      kinds={PROJECT_KINDS}
      itemsSource="boq"
      heading="Letters"
      description="Letters of intent and work orders issued on this project. Each is versioned: reissuing supersedes rather than replaces, so what was sent stays readable."
      emptyMessage="No letter has been issued on this project."
    />
  );
}
