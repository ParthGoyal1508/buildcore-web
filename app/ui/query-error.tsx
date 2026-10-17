'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import { RowAction } from '@/app/ui/button';

/**
 * What a screen shows when its data did not load, with a way to try again (036 A4).
 *
 * Before this, 68 lists printed "Could not load this list" in red and stopped: the only recovery was
 * a full page reload, which on a site phone also throws away whatever else was on screen. Most of
 * these failures are a dropped connection that is back seconds later, so the button matters more
 * than the wording.
 *
 * The message is the server's own when there is one (`errorMessage`), so a refusal that explains
 * itself — "This project is locked for billing" — is not replaced by a generic line; `fallback`
 * covers everything that did not come from the server.
 *
 *     if (query.isError) return <QueryError error={query.error} onRetry={query.refetch} />;
 *
 * `onRetry` may return a promise (React Query's `refetch` does); the button shows a spinner and stays
 * disabled until it settles, so an impatient second tap does not queue a second request.
 */
export default function QueryError({
  error,
  onRetry,
  fallback = 'This could not be loaded. Please try again.',
  message,
  compact = false,
  className,
}: {
  error?: unknown;
  onRetry?: () => unknown;
  /** Shown when the error carries no message from the server. */
  fallback?: string;
  /** Overrides the error's own message entirely. */
  message?: string;
  /** One line, for a panel inside a page rather than the page itself. */
  compact?: boolean;
  className?: string;
}) {
  const [retrying, setRetrying] = useState(false);
  const text = message ?? errorMessage(error, fallback);

  const retry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className={clsx(
        'flex rounded-lg border border-red-200 bg-red-50 text-sm text-red-800',
        compact
          ? 'items-center gap-2 px-3 py-2'
          : 'flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:items-center',
        className,
      )}
    >
      <ExclamationTriangleIcon
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-red-500"
      />
      <p className="min-w-0 flex-1">{text}</p>
      {onRetry && (
        // A row action's shape (036 A21); "Retry" picks up its refresh icon from the verb.
        <RowAction
          type="button"
          intent="read"
          onClick={retry}
          loading={retrying}
          className="shrink-0"
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </RowAction>
      )}
    </div>
  );
}
