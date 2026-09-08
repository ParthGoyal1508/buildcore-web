'use client';

import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import PageHeader from '@/app/ui/page-header';
import { visibleProjectSections } from '@/app/ui/projects/sections';
import TileGrid from '@/app/ui/tile-grid';

/**
 * The Projects index.
 *
 * Tiles, like HR & Payroll, Settings, Partners and My Workspace — a module lands on
 * what it contains and you click into a section. Replaces the `<ModuleInProgress />`
 * placeholder feature 014 put here while this module was unbuilt.
 *
 * A client component because the tile list is permission-filtered, and the answer
 * comes from the same `['currentUser']` query the layout guard and the sidebar
 * already share — so this costs no extra request.
 */
export default function ProjectsPage() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  const sections = visibleProjectSections(user);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Your project portfolio, and the clients and sites it runs on."
      />
      {isLoading ? (
        <p className="text-sm text-gray-500" role="status">
          Loading…
        </p>
      ) : (
        <TileGrid
          tiles={sections.map((section) => ({
            name: section.title,
            href: section.href,
            description: section.description,
            icon: section.icon,
          }))}
        />
      )}
    </main>
  );
}
