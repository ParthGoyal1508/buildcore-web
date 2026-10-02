'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

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
            retry: false,
            refetchOnWindowFocus: false,
          },
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
