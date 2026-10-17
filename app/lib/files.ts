/**
 * Reading, checking and shrinking a file before it is uploaded (036 A27).
 *
 * Every upload in this app sends the file as base64 inside JSON, and each screen did the work
 * itself: two copies read the file a byte at a time into a string (`String.fromCharCode` in a loop,
 * which on a 10 MB scan builds ten million one-character strings and froze a mid-range phone for
 * seconds), nothing checked the size until the server refused it, and a 12-megapixel site photo
 * went up at full size over a site connection. One copy of each step now, used by `<FileUpload>`
 * and by the api modules that still take a `File`.
 */

/** The per-file limit the API enforces (036 B4, decision 9). Checked here first, before reading. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Images and PDFs — what nearly every upload here takes. */
export const ACCEPT_IMAGES_AND_PDF =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf';

/** `12.4 MB`, `830 KB`, `512 B`. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * The file's bytes as base64 — the data portion only, which is what the API decodes.
 *
 * `FileReader.readAsDataURL` encodes natively, off the main thread's string machinery, rather than
 * the byte-by-byte loop this replaces.
 */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Whether a file matches an `accept` list (`.pdf`, `image/*`, `application/pdf`).
 *
 * The browser's own `accept` only filters the picker, and not at all for a dropped file or on
 * Android's "Files" tab, so the same list is checked again here.
 */
export function matchesAccept(file: File, accept: string | undefined): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => {
      if (token.startsWith('.')) return name.endsWith(token);
      if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
      return type === token;
    });
}

/** Image types a canvas can redraw. GIF (animation) and SVG (vector) are left alone. */
const COMPRESSIBLE = /^image\/(jpeg|png|webp|bmp)$/i;

/**
 * A large photo, redrawn at no more than `maxDimension` pixels on its long side and re-encoded as
 * WebP (JPEG where the browser cannot write WebP), at `quality`.
 *
 * Returns the original file when it is not an image a canvas can redraw, when it is already small,
 * when decoding fails (HEIC on most browsers) or when the result would not be smaller — so it is
 * always safe to call. A 4 MB phone photo comes out around 300–500 KB, readable for a bill or a
 * receipt, and a third the upload time on a site connection.
 */
export async function compressImage(
  file: File,
  {
    maxDimension = 2048,
    quality = 0.8,
    minBytes = 300 * 1024,
  }: { maxDimension?: number; quality?: number; minBytes?: number } = {},
): Promise<File> {
  if (!COMPRESSIBLE.test(file.type) || typeof document === 'undefined') {
    return file;
  }
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= minBytes) return file;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    // A transparent PNG drawn onto JPEG would turn its transparency black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const toBlob = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    // Safari before 17 silently returns a PNG when asked for WebP; check what actually came back.
    let blob = await toBlob('image/webp');
    if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg');
    if (!blob || blob.size >= file.size) return file;
    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const stem = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${stem}.${extension}`, {
      type: blob.type,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
