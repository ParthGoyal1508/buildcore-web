'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { visibleHrSections } from '@/app/ui/hr/sections';
import SectionTabs from '@/app/ui/section-tabs';

/**
 * Sub-navigation within HR & Payroll, shown inside a section but not on the index —
 * there the tiles are the navigation, and a strip repeating them would be the same
 * links twice with no tab active.
 *
 * Filtered by the same `visibleHrSections()` the tiles use, so the strip can never
 * offer a section `app/dashboard/hr/layout.tsx` would then refuse.
 *
 * Ten sections is more than fits at most widths; `SectionTabs` scrolls horizontally
 * inside its own container rather than letting the page scroll sideways.
 */
export default function HrNav() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const tabs = visibleHrSections(user).map((section) => ({
    name: section.title,
    href: section.href,
  }));

  if (tabs.length === 0) return null;

  return <SectionTabs label="HR & Payroll sections" tabs={tabs} />;
}
