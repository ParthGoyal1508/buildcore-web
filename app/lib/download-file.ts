import type { StoredFile } from '@/app/lib/api/client';

/**
 * Types a browser renders in a tab. Anything else is saved to disk instead.
 *
 * Narrow on purpose. Handing an unrenderable type to `window.open` is what produced the
 * original complaint: a tab opens, the browser cannot display the file, and it lands in
 * Downloads under the blob URL's own name — a UUID, with no extension, which the operating
 * system then opens in a text editor.
 */
const RENDERABLE = [
  'application/pdf',
  'image/',
  'text/plain',
  'text/csv',
] as const;

function isRenderable(type: string): boolean {
  const bare = type.split(';')[0].trim().toLowerCase();
  return RENDERABLE.some((prefix) => bare.startsWith(prefix));
}

/** An anchor click with `download`, the one way to hand the browser a blob *and* its name. */
function clickAnchor(url: string, name: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  // Appended before clicking: Firefox ignores a click on an anchor that is not in the
  // document, and does so silently.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Whether this is Safari on an iPhone or an iPad (042) — where two things the rest of the app
 * takes for granted do not hold:
 *
 * - `window.open` after any `await` is a pop-up, and iOS blocks it **silently**: it returns
 *   `null` and nothing appears, so the person taps "View" and concludes the document is broken.
 * - A PDF loaded into a hidden `<iframe>` and printed comes out **blank** — iOS renders only a
 *   PDF's own view, never a frame's, into the print surface.
 *
 * An iPad reports itself as "MacIntel" since iPadOS 13, which is what the `maxTouchPoints` arm
 * catches. Feature-detecting either failure is not possible — `window.open`'s block *is* the
 * signal, and a blank print never reports anything — so this is the rare place a platform sniff
 * is the honest option.
 */
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const iDevice =
    /iP(ad|hone|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // Chrome and Firefox on iOS are Safari's engine with their own chrome; they block the same way.
  return iDevice;
}

/**
 * Opens a renderable blob in a new tab, surviving the pop-up blocker (042).
 *
 * `window.open` called after an `await` — which is every call here, because the file must be
 * fetched with the bearer token first — is a pop-up to iOS Safari and to desktop browsers with
 * stricter settings, and a blocked one returns `null` with no error. When that happens the file
 * is handed over as a named download instead: iOS presents it in its own preview with a working
 * share/print sheet, so the person still gets the document rather than a dead button.
 *
 * The object URL is revoked on a timer rather than immediately: a new tab needs it to still
 * resolve when it loads, and never revoking leaks the blob for the life of the page.
 */
export function openBlobInTab(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) clickAnchor(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Opens a document the server just sent, under the name the server gave it.
 *
 * A blob URL carries no filename, so a download started from one is named after the URL —
 * `524169d0-0cbe-4c5f-85f3-464b4da3c673`. The `download` attribute is the only way to say what
 * the file is called, and it only works on an anchor, which is why this does not use
 * `window.open` for anything it cannot render.
 *
 * A PDF or an image opens in a tab, because "Open" is what the buttons calling this say and
 * reading the document is the common errand — falling back to a named download where the tab is
 * pop-up-blocked (see `openBlobInTab`). Everything else is saved, where the name and the
 * extension are what make it openable at all.
 */
export function openStoredFile(file: StoredFile, fallbackName: string): void {
  const name = file.filename || fallbackName;

  if (isRenderable(file.blob.type)) {
    openBlobInTab(file.blob, name);
  } else {
    const url = URL.createObjectURL(file.blob);
    clickAnchor(url, name);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

/** Hands a downloaded blob to the browser as a save. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick rather than immediately: revoking synchronously can
  // beat the browser to reading the URL and produce an empty file.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
