'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import PageHeader from '@/app/ui/page-header';
import { visibleSettingsSections } from '@/app/ui/settings/sections';
import TileGrid from '@/app/ui/tile-grid';

/** Lists only the sections the signed-in user can actually open, so nobody is
 * invited into a page that will just refuse them. The list itself lives in
 * `sections.ts`, shared with the in-module tab strip. */
export default function SettingsPage() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const visible = visibleSettingsSections(user);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Companies, roles, users and the masters the rest of the app reads."
      />
      {user && visible.length === 0 && (
        <p className="text-sm text-gray-600">
          Your role doesn&apos;t include access to any Settings section.
        </p>
      )}
      <TileGrid
        tiles={visible.map((section) => ({
          name: section.title,
          href: section.href,
          description: section.description,
          icon: section.icon,
        }))}
      />
    </main>
  );
}
