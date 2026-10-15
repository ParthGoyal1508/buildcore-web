/**
 * Serves the in-page PDF viewer's document under its real file name (2026-10-15).
 *
 * Chrome's PDF viewer names a document after the last segment of the URL it was loaded from — the
 * toolbar shows it and "Download" in that toolbar saves under it. A blob URL's last segment is a
 * UUID, so a bill opened in the viewer read `332cc282-…` and saved as `332cc282-….pdf`. Neither a
 * `File` with a name nor a `#fragment` changes that (verified in Chrome 2026-10-15); only a URL whose
 * path ends in the name does.
 *
 * So `app/ui/pdf-viewer.tsx` hands the bytes here and points the frame at
 * `/__view/<random id>/<file name>`, which this worker answers from memory. Memory only — never the
 * Cache API — because these are authenticated, sometimes regulated documents, and nothing here
 * should outlive the page that fetched them or reach whoever signs in next on a shared machine.
 *
 * Deliberately separate from the Serwist worker (`app/sw.ts`, scope `/`): its own narrow scope,
 * no build step, and present in development too.
 */
const files = new Map();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'put') {
    files.set(data.id, { blob: data.blob, type: data.contentType });
  } else if (data.type === 'drop') {
    files.delete(data.id);
  }
  if (event.ports[0]) event.ports[0].postMessage('ok');
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const match = url.pathname.match(/^\/__view\/([^/]+)\/([^/]+)$/);
  if (!match) return;
  const file = files.get(match[1]);
  if (!file) {
    event.respondWith(
      new Response(
        'This document is no longer open. Close the viewer and open it again.',
        {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        },
      ),
    );
    return;
  }
  event.respondWith(
    new Response(file.blob, {
      headers: {
        'Content-Type': file.type,
        'Content-Disposition': `inline; filename*=UTF-8''${match[2]}`,
        'Cache-Control': 'no-store',
      },
    }),
  );
});
