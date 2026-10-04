import { ROUTES } from '@/app/lib/constants';

/**
 * The sections of one project, in the order the shell's tab strip presents them.
 *
 * Mirrors `app/ui/projects/sections.ts` one level down: that file lists the sections of the
 * Projects *module*, this one the sections of a single project. Declared once for the same
 * reason — a section defined in the nav and nowhere else is a dead tab, and one defined as a
 * route and not in the nav is a page nobody can reach, which is exactly the state every one of
 * these pages was in until 2026-10-04.
 *
 * Order is the working order, not the data order: what the project *is* (Overview), what it is
 * to build (BOQ), what it holds (Documents), who and what is on it, then the money. Edit is
 * last because changing the project is the rarest of these and the only destructive one.
 *
 * `permission` is `PROJECTS` unless the backend guards the section's endpoints with something
 * else. The three money sections are guarded with `PROJECT_FINANCIALS` — the same check
 * `FinancialsGuard` makes on the pages themselves. Both are needed and neither is redundant:
 * this one stops the tab being offered, that one explains the refusal to somebody who arrives
 * by URL.
 */
export const PROJECT_DETAIL_SECTIONS: {
  key: string;
  href: (id: string) => string;
  title: string;
  permission: 'PROJECTS' | 'PROJECT_FINANCIALS';
}[] = [
  {
    key: 'overview',
    href: ROUTES.projectsProject,
    title: 'Overview',
    permission: 'PROJECTS',
  },
  {
    key: 'boq',
    href: ROUTES.projectsBoq,
    title: 'BOQ',
    permission: 'PROJECTS',
  },
  {
    key: 'documents',
    href: ROUTES.projectsProjectDocuments,
    title: 'Documents',
    permission: 'PROJECTS',
  },
  {
    key: 'people',
    href: ROUTES.projectsPeople,
    title: 'People',
    permission: 'PROJECTS',
  },
  {
    key: 'machinery',
    href: ROUTES.projectsMachinery,
    title: 'Machinery',
    permission: 'PROJECTS',
  },
  {
    key: 'materials',
    href: ROUTES.projectsMaterials,
    title: 'Materials',
    permission: 'PROJECTS',
  },
  {
    key: 'billing',
    href: ROUTES.projectsBilling,
    title: 'Client bills',
    permission: 'PROJECT_FINANCIALS',
  },
  {
    key: 'ra-bills',
    href: ROUTES.projectsRaBills,
    title: 'Subcontractors',
    permission: 'PROJECT_FINANCIALS',
  },
  {
    key: 'summary',
    href: ROUTES.projectsSummary,
    title: 'Position',
    permission: 'PROJECT_FINANCIALS',
  },
  {
    key: 'edit',
    href: ROUTES.projectsEditProject,
    title: 'Edit',
    permission: 'PROJECTS',
  },
];

/**
 * The sections this user may actually open, as hrefs for one project.
 *
 * Returns nothing at all while the user is unknown rather than guessing — a tab strip that
 * appears and then loses two tabs a moment later is worse than one that appears once.
 */
export function visibleProjectDetailSections(
  user: { permissions: readonly string[] } | undefined,
  projectId: string,
): { name: string; href: string }[] {
  if (!user) return [];
  return PROJECT_DETAIL_SECTIONS.filter((section) =>
    user.permissions.includes(section.permission),
  ).map((section) => ({ name: section.title, href: section.href(projectId) }));
}
