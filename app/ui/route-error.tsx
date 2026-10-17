'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect } from 'react';

/**
 * The fallback every route error boundary renders (036 A1).
 *
 * There was no `error.tsx` anywhere, so a render error — or, far more often, a chunk that no longer
 * exists after a deploy — replaced the whole app with Next's bare "Application error: a client-side
 * exception has occurred". The service worker activates a new build at once (`skipWaiting`), so a
 * tab left open over a deploy asks for the old build's chunks by name and gets 404s: every user who
 * had the app open at release time hit this on their next navigation.
 *
 * A failed chunk is fixed by loading the new build, so that case reloads by itself — **once**: the
 * marker in `sessionStorage` stops a chunk that is genuinely missing from reloading for ever.
 */
const CHUNK_RELOAD_KEY = 'buildcore:chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 60_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === 'ChunkLoadError' ||
    /loading (css )?chunk [\w-]+ failed|failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module/i.test(
      error.message,
    )
  );
}

/** Reloads the page for a chunk error, unless it already did so in the last minute. */
function reloadOnceForChunk(error: unknown): boolean {
  if (!isChunkLoadError(error) || typeof window === 'undefined') return false;
  try {
    const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (Date.now() - last < CHUNK_RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage refused (private mode): reloading without the guard could loop, so do not.
    return false;
  }
  window.location.reload();
  return true;
}

export default function RouteError({
  error,
  retry,
  homeHref = '/',
  homeLabel = 'Go to home',
}: {
  error: Error & { digest?: string };
  /** Next's `retry` (re-fetch and re-render) or `reset` (re-render only). */
  retry: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    if (!reloadOnceForChunk(error)) console.error(error);
  }, [error]);

  const chunk = isChunkLoadError(error);

  return (
    <div
      role="alert"
      className="mx-auto my-10 flex max-w-md flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm"
    >
      <ExclamationTriangleIcon className="w-10 text-amber-500" aria-hidden="true" />
      <h1 className="text-lg font-semibold text-gray-900">
        {chunk
          ? 'A new version of BuildCore is available'
          : 'Something went wrong on this page'}
      </h1>
      <p className="text-sm text-gray-600">
        {chunk
          ? 'Reload to continue with the latest version.'
          : 'Try again. If it keeps happening, go back to the home page and let your administrator know what you were doing.'}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-gray-400">Reference: {error.digest}</p>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => (chunk ? window.location.reload() : retry())}
          className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {chunk ? 'Reload' : 'Try again'}
        </button>
        <Link
          href={homeHref}
          className="flex h-10 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          {homeLabel}
        </Link>
      </div>
    </div>
  );
}
