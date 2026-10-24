'use client';

import '@/app/ui/global.css';
import RouteError from '@/app/ui/route-error';

/**
 * The last boundary, for an error in the root layout itself (036 A1).
 *
 * Replaces the whole document, so it brings its own `<html>`, `<body>` and stylesheet; nothing from
 * the root layout (providers, fonts) is available here, which is why `RouteError` uses none of them.
 */
export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 p-4 antialiased">
        <title>Something went wrong | Tirupati Groups</title>
        <RouteError error={error} retry={retry ?? reset} />
      </body>
    </html>
  );
}
