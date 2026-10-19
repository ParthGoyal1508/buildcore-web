'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { isTransientError } from '@/app/lib/api/client';

/**
 * One `QueryClient` for the whole app (research.md §3).
 *
 * Created inside `useState` rather than at module scope: a module-level client is
 * shared across requests on the server, which would leak one user's cached data
 * into another's render.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
        defaultOptions: {
          queries: {
            // Settings data is admin-edited rarely and read often; a short stale
            // window avoids a refetch storm as the user moves between tabs.
            staleTime: 30_000,
            // A 401 is handled by authFetch's own refresh-and-retry, and a 403
            // will never succeed on retry — neither is worth re-attempting here.
            // 036 A4: a read that failed for want of a network, a timeout or a 5xx is tried twice
            // more (React Query's backoff: 1 s, then 2 s) before the screen shows its error. A
            // flaky site connection used to put "Could not load" on screen for a blip that was
            // over before anyone read it. Never a 4xx: the same request is refused the same way.
            retry: (failureCount, error) =>
              failureCount < 2 && isTransientError(error),
            refetchOnWindowFocus: false,
          },
          // Never retried automatically, whatever the failure: a save that timed out may well
          // have landed, and repeating it is how a payment is recorded twice.
          mutations: { retry: false },
        },
      });

    /**
     * Who the caller is, and what they may do, is never served stale (019 FR-010, task T028).
     *
     * The 30-second `staleTime` above is right for settings data and wrong for this. Every
     * module guard, every hidden write control and every section tab is decided from
     * `['currentUser']`, which roughly 45 components read — so a cached entry is a window in
     * which a user whose access was revoked is still offered the controls, and a user newly
     * granted access is still refused. The second is the one that generates support calls; the
     * first is the one that matters.
     *
     * `refetchOnMount: 'always'` rather than a shorter `staleTime`, because the risk is not
     * age — it is a mount that trusts whatever is in the cache. The cached value is still
     * rendered immediately, so this costs one background request per navigation and no
     * perceptible delay.
     *
     * Set here, once, rather than at 45 call sites: a rule that has to be remembered at each
     * read is a rule that is already broken somewhere.
     */
    client.setQueryDefaults(['currentUser'], {
      staleTime: 0,
      refetchOnMount: 'always',
    });

    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
