import {
  BuildingOffice2Icon,
  MapPinIcon,
  RectangleStackIcon,
} from '@heroicons/react/24/outline';

import { PROJECTS_PERMISSIONS, ROUTES, type ProjectsSection } from '@/app/lib/constants';

/**
 * The sections of Projects, in the order both the index tiles and the in-module tab
 * strip present them.
 *
 * One definition, two presentations: `app/dashboard/projects/page.tsx` renders the
 * tiles a user lands on and `projects-nav.tsx` the tabs they move between
 * afterwards. Declaring the list twice is how a section ends up in one and not the
 * other — the same reason `app/ui/hr/sections.ts` and `app/ui/settings/sections.ts`
 * exist.
 *
 * Portfolio is first because it is what the module is *for*; Clients and Sites are
 * the masters it depends on.
 */
export const PROJECT_SECTIONS: {
  key: ProjectsSection;
  href: string;
  title: string;
  description: string;
  icon: typeof RectangleStackIcon;
}[] = [
  {
    key: 'portfolio',
    href: ROUTES.projectsPortfolio,
    title: 'Portfolio',
    description: 'Every project, its contract value, status and lock state.',
    icon: RectangleStackIcon,
  },
  {
    key: 'clients',
    href: ROUTES.projectsClients,
    title: 'Clients',
    description: 'The parties projects are executed for.',
    icon: BuildingOffice2Icon,
  },
  {
    key: 'sites',
    href: ROUTES.projectsSites,
    title: 'Sites',
    description: 'Locations, geofences and the weekly-off calendar.',
    icon: MapPinIcon,
  },
];

/**
 * The sections this user may actually open.
 *
 * Shared by the tiles and the tabs so neither can offer a section the layout guard
 * would then refuse — a visible dead link is the failure feature 014 exists to
 * prevent, and it is no less dead for being a tab.
 */
export function visibleProjectSections(
  user: { permissions: readonly string[] } | undefined,
): typeof PROJECT_SECTIONS {
  if (!user) return [];
  return PROJECT_SECTIONS.filter((section) =>
    user.permissions.includes(PROJECTS_PERMISSIONS[section.key]),
  );
}
