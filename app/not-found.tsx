import Link from 'next/link';

import Logo from '@/app/ui/logo';

export const metadata = { title: 'Page not found' };

/**
 * The branded 404 (036 A1), in place of Next's bare black-on-white one.
 *
 * Links to `/`, the app's own entry point, so this page needs to know nothing about the session.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <Logo className="h-10 w-auto" />
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          404
        </p>
        <h1 className="text-xl font-semibold text-gray-900">
          This page doesn’t exist
        </h1>
        <p className="text-sm text-gray-600">
          The link may be out of date, or the address may have been typed
          wrongly.
        </p>
        <Link
          href="/"
          className="flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          Go to home
        </Link>
      </div>
    </main>
  );
}
