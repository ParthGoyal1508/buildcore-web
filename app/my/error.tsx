'use client';

import { ROUTES } from '@/app/lib/constants';
import RouteError from '@/app/ui/route-error';

/** A render error inside My Workspace keeps its shell and replaces only the page (036 A1). */
export default function MyWorkspaceError({
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
      homeHref={ROUTES.myWorkspace}
      homeLabel="Go to My Workspace"
    />
  );
}
