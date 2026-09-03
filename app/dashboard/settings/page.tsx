'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '@/app/lib/api/users';
import { lusitana } from '@/app/ui/fonts';
import { visibleSettingsSections } from '@/app/ui/settings/sections';

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
    <main>
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Settings</h1>
      {user && visible.length === 0 && (
        <p className="text-sm text-gray-600">
          Your role doesn&apos;t include access to any Settings section.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
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
    </main>
  );
}
