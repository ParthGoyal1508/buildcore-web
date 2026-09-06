'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { visibleHrSections } from '@/app/ui/hr/sections';
import TileGrid from '@/app/ui/tile-grid';

/** Shows only the areas the signed-in user can open, so nobody is invited into a
 * page that would immediately refuse them — same rule the Settings index follows.
 * The list itself lives in `sections.ts`, shared with the in-module tab strip. */
export default function HrSectionGrid() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const visible = visibleHrSections(user);

  if (user && visible.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        Your role doesn&apos;t include access to any HR &amp; Payroll area.
      </p>
    );
  }

  return (
    <TileGrid
      tiles={visible.map((section) => ({
        name: section.title,
        href: section.href,
        description: section.description,
        icon: section.icon,
      }))}
    />
  );
}
