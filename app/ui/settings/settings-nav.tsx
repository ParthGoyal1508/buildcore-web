'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { visibleSettingsSections } from '@/app/ui/settings/sections';
import SectionTabs from '@/app/ui/section-tabs';

/**
 * Sub-navigation within Settings, shown inside a section but not on the index.
 * Filtered by the same `visibleSettingsSections()` the index tiles use, so the strip
 * cannot offer a section the layout guard would refuse.
 */
export default function SettingsNav() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const tabs = visibleSettingsSections(user).map((section) => ({
    name: section.title,
    href: section.href,
  }));

  if (tabs.length === 0) return null;

  return <SectionTabs label="Settings sections" tabs={tabs} />;
}
