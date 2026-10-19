'use client';

import { ROUTES } from '@/app/lib/constants';
import RouteError from '@/app/ui/route-error';

/** A render error inside the dashboard shell keeps the shell and replaces only the page (036 A1). */
export default function DashboardError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      retry={retry ?? reset}
      homeHref={ROUTES.dashboard}
      homeLabel="Go to the dashboard"
    />
  );
}
