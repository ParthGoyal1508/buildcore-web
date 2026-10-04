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

/**
 * Opens a document the server just sent, under the name the server gave it.
 *
 * A blob URL carries no filename, so a download started from one is named after the URL —
 * `524169d0-0cbe-4c5f-85f3-464b4da3c673`. The `download` attribute is the only way to say what
 * the file is called, and it only works on an anchor, which is why this does not use
 * `window.open` for anything it cannot render.
 *
 * A PDF or an image opens in a tab, because "Open" is what the buttons calling this say and
 * reading the document is the common errand. Everything else is saved, where the name and the
 * extension are what make it openable at all.
 *
 * The object URL is revoked on a timer rather than immediately: a new tab needs it to still
 * resolve when it loads, and never revoking leaks the blob for the life of the page.
 */
export function openStoredFile(file: StoredFile, fallbackName: string): void {
  const url = URL.createObjectURL(file.blob);
  const name = file.filename || fallbackName;

  if (isRenderable(file.blob.type)) {
    window.open(url, '_blank', 'noopener');
  } else {
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

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
