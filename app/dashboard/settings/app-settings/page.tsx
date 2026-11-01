import type { Metadata } from 'next';

import PageHeader from '@/app/ui/page-header';
import AppSettings from '@/app/ui/settings/app-settings';

export const metadata: Metadata = { title: 'App Settings' };

/**
 * App Settings (2026-11-01, formerly Personal Settings): the one home of the cash visibility
 * switch, disguised as a "Slate theme" row in a table of display preferences — see
 * `app/ui/settings/app-settings.tsx`. Super Admin only, behind their own password; the settings
 * layout refuses this route to anybody without `CROSS_COMPANY_ACCESS`.
 */
export default function AppSettingsPage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="App Settings"
        description="Display, regional and navigation preferences."
      />
      <AppSettings />
    </main>
  );
}
