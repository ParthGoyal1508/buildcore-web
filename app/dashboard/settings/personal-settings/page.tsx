import type { Metadata } from 'next';

import PageHeader from '@/app/ui/page-header';
import CashVisibility from '@/app/ui/settings/cash-visibility';

export const metadata: Metadata = { title: 'Personal Settings' };

/**
 * Personal Settings: the one home of the cash visibility switch (2026-10-14), under this name since
 * 2026-10-15 so the Settings index does not announce what is behind the password.
 *
 * It used to sit in the top bar of every screen as well. The client moved it here, Super Admin
 * only, behind their own password — the settings layout refuses this route to anybody without
 * `CROSS_COMPANY_ACCESS`, the component shows only a password prompt until it is verified, and the
 * API refuses the change itself without that verification.
 *
 * 036 C16: the audit found "Personal" misleading for a company-wide switch. The name is the client's
 * own choice (2026-10-15), so it stays; the description now says the settings apply to the whole
 * company, and the switch itself names the company (036 C13).
 */
export default function PersonalSettingsPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Personal Settings"
        description="Sensitive settings that apply to the whole company, not only to you. Super Admin only."
      />
      <CashVisibility />
    </main>
  );
}
