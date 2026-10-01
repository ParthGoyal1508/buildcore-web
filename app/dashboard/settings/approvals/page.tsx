import ApprovalSettings from '@/app/ui/settings/approval-settings';
import DirectorFinalSettings from '@/app/ui/settings/director-final-settings';
import PageHeader from '@/app/ui/page-header';

export const metadata = { title: 'Approval settings' };

/**
 * Who decides at each level of an approval chain (feature 016 FR-001a).
 *
 * This screen is what makes the rest of the feature usable. A chain's levels name a
 * **slot** — "first approver", "HR", "Director" — and each company maps its own roles to
 * them, because neither "HR Office" nor "Site Incharge" is a role in this system and the
 * two companies may staff the same chain shape differently. Until those mappings exist,
 * every item entering a chain waits at a level nobody holds.
 */
export default function ApprovalSettingsPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Approvals"
        description="Which of your roles decides at each level of an approval chain."
      />
      <ApprovalSettings />
      {/*
        Same screen as the slot mappings, deliberately (016 FR-017). Both answer "who decides
        here": the mappings say which role fills a level, this says which actions the Director
        must be one of. Splitting them across two pages would mean nobody reviewing approval
        configuration sees both halves of it.
      */}
      <DirectorFinalSettings />
    </main>
  );
}
