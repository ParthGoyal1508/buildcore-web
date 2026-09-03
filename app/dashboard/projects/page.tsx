'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { lusitana } from '@/app/ui/fonts';
import { visibleProjectSections } from '@/app/ui/projects/sections';

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
    <main>
      <h1 className={`${lusitana.className} mb-2 text-2xl`}>Projects</h1>
      <p className="mb-6 text-sm text-gray-600">
        Your project portfolio, and the clients and sites it runs on.
      </p>

      {isLoading ? (
        <p className="text-sm text-gray-500" role="status">
          Loading…
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="flex gap-3 rounded-lg bg-gray-50 p-4 transition-colors hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <Icon className="w-6 shrink-0 text-gray-500" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-medium text-gray-900">
                    {section.title}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {section.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
