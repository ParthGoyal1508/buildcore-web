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
  const [queryClient] = useState(
    () =>
      new QueryClient({
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
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
