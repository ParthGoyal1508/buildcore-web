import type { Metadata } from 'next';

import PageHeader from '@/app/ui/page-header';
import CashVisibility from '@/app/ui/settings/cash-visibility';

export const metadata: Metadata = { title: 'Cash visibility' };

/**
 * The one home of the cash visibility switch (2026-10-14).
 *
 * It used to sit in the top bar of every screen as well. The client moved it here, Super Admin
 * only, behind their own password — the settings layout refuses this route to anybody without
 * `CROSS_COMPANY_ACCESS`, the component shows only a password prompt until it is verified, and the
 * API refuses the change itself without that verification.
 */
export default function CashVisibilityPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Cash visibility"
        description="Hide cash amounts across the application. Super Admin only."
      />
      <CashVisibility />
    </main>
  );
}
