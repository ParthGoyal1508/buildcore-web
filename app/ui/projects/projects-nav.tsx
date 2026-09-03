'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import SectionTabs from '@/app/ui/section-tabs';
import { visibleProjectSections } from '@/app/ui/projects/sections';

/**
 * Sub-navigation within Projects, shown inside a section but not on the index.
 *
 * Filtered by the same function the tiles use, so a tab can never offer a section
 * the tiles withheld. Renders nothing rather than an empty strip when the answer is
 * not yet known — the layout below it is already handling the loading state, and a
 * bare border rule appearing first reads as a broken page.
 *
 * The active-tab rule lives in `SectionTabs`; see it for why longest match rather
 * than a prefix test.
 */
export default function ProjectsNav() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const tabs = visibleProjectSections(user).map((section) => ({
    name: section.title,
    href: section.href,
  }));
  if (tabs.length === 0) return null;

  return <SectionTabs label="Projects sections" tabs={tabs} />;
}
