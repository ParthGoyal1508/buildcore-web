import type { Metadata } from 'next';
import Link from 'next/link';

import { lusitana } from '@/app/ui/fonts';
import { MY_SECTIONS } from '@/app/ui/my/sections';

export const metadata: Metadata = { title: 'My Workspace' };

/**
 * The My Workspace index.
 *
 * Tiles, like HR & Payroll, Settings and Partners — a module lands on what it
 * contains and you click into a section. This used to `redirect()` straight to
 * Punch, which made My Workspace the one module in the app that behaved differently.
 *
 * Punch is still one tap away, and on a phone it is closer than that: the bottom bar
 * is on every screen in this shell, including this one.
 */
export default function MyWorkspacePage() {
  return (
    <main>
      <h1 className={`${lusitana.className} mb-2 text-2xl`}>My Workspace</h1>
      <p className="mb-6 text-sm text-gray-600">
        Your attendance, leave, salary and claims.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MY_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href}
              className="flex gap-3 rounded-lg bg-gray-50 p-4 transition-colors hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <Icon className="w-6 shrink-0 text-gray-500" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-medium text-gray-900">{section.name}</h2>
                <p className="mt-1 text-sm text-gray-600">{section.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
