import type { Metadata } from 'next';

import { MY_SECTIONS } from '@/app/ui/my/sections';
import PageHeader from '@/app/ui/page-header';
import TileGrid from '@/app/ui/tile-grid';

export const metadata: Metadata = { title: 'My Workspace' };

/**
 * The My Workspace index.
 *
 * Tiles, like HR & Payroll, Settings and Partners — a module lands on what it
 * contains and you click into a section. This used to `redirect()` straight to
 * Punch, which made My Workspace the one module in the app that behaved differently.
 *
 * Punch is still one tap away, and on a phone it is closer than that: the bottom bar
 * is on every screen in this shell, including this one.
 */
export default function MyWorkspacePage() {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="My Workspace"
        description="Your attendance, leave, salary and claims."
      />
      <TileGrid tiles={MY_SECTIONS} />
    </main>
  );
}
