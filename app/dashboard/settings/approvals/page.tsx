import ApprovalSettings from '@/app/ui/settings/approval-settings';
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
    </main>
  );
}
