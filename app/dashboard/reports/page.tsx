import type { Metadata } from 'next';

import ModuleInProgress from '@/app/ui/module-in-progress';

export const metadata: Metadata = { title: 'Reports' };

/** Placeholder until the feature that owns this module lands. See
 * `app/ui/module-in-progress.tsx` for why the route exists at all. */
export default function ReportsPage() {
  return <ModuleInProgress moduleId="reports" />;
}
