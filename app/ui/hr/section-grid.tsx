'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { getCurrentUser } from '@/app/lib/api/users';
import { visibleHrSections } from '@/app/ui/hr/sections';

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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((section) => {
        const Icon = section.icon;
        return (
          <Link
            key={section.key}
            href={section.href}
            className="flex gap-3 rounded-lg bg-gray-50 p-4 transition-colors hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <Icon className="w-6 shrink-0 text-gray-500" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-medium text-gray-900">{section.title}</h2>
              <p className="mt-1 text-sm text-gray-600">{section.description}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
