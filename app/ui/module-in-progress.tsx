import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';

import { MESSAGES, NAV_MODULES, type NavModuleId } from '@/app/lib/constants';
import { lusitana } from '@/app/ui/fonts';

/**
 * Stands in for a module whose sidebar entry exists but whose feature has not been
 * built yet (Projects, Plant & Machinery, Inventory, Reports).
 *
 * These are reachable because feature 014 draws the sidebar from `NAV_MODULES`,
 * which has to name every module for the permission filter to cover it — so a user
 * holding, say, `PROJECTS` sees a Projects link and, until this existed, got Next's
 * bare 404 for following a link the app drew itself. A 404 says "this address is
 * wrong"; the address is right, the feature is just not here yet, and those are
 * different things to tell someone.
 *
 * Distinct from `AccessDenied` on purpose: that means "not for you", this means "not
 * yet for anyone". `ModuleGuard` still runs first, so a user without the module's
 * permission is refused and never reaches this.
 *
 * The name comes from `NAV_MODULES` rather than a prop, so the placeholder and the
 * sidebar can never disagree about what a module is called (FR-014's single
 * definition). Delete the page that renders this when the module lands.
 */
export default function ModuleInProgress({
  moduleId,
}: {
  moduleId: NavModuleId;
}) {
  const name = NAV_MODULES.find((module) => module.id === moduleId)?.name ?? '';

  return (
    <main
      role="status"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg bg-gray-50 p-8 text-center"
    >
      <WrenchScrewdriverIcon className="w-10 text-gray-400" aria-hidden="true" />
      <h1 className={`${lusitana.className} text-xl`}>
        {MESSAGES.moduleInProgressTitle(name)}
      </h1>
      <p className="text-sm text-gray-600">{MESSAGES.moduleInProgressBody}</p>
    </main>
  );
}
