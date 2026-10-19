'use client';

import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  DocumentIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  ACCEPT_IMAGES_AND_PDF,
  MAX_UPLOAD_BYTES,
  compressImage,
  fileToBase64,
  formatBytes,
  matchesAccept,
} from '@/app/lib/files';
import { Spinner } from '@/app/ui/spinner';
import { IconButton } from '@/app/ui/button';

/** A file made ready to send: possibly shrunk, already in base64 for the JSON body. */
export interface PreparedFile {
  /** The file to send — the compressed copy when compression helped, else the original. */
  file: File;
  /** `file`'s bytes as base64, data portion only. */
  base64: string;
  fileName: string;
  mimeType: string;
  size: number;
  /** The size as picked, before compression. */
  originalSize: number;
}

type Stage = 'idle' | 'preparing' | 'uploading' | 'done' | 'error';

/**
 * The one way to pick a file for upload (036 A27).
 *
 * Every upload screen had its own `<input type="file">` and most had none of this: no `accept`, no
 * size check until the server refused a 14 MB scan after a minute of sending it, no preview, no
 * sign of progress, and an input that was never reset — so after a failure, picking the same file
 * again fired no change event and *nothing happened*. This does each step once:
 *
 * 1. checks the type against `accept` and the size against `maxBytes` before reading anything;
 * 2. shrinks a photo (canvas, ≤ 2048 px, WebP or JPEG at 0.8) — PDFs and other files untouched;
 * 3. reads it to base64 (`PreparedFile`);
 * 4. either uploads at once through `onUpload` — "Preparing…", "Uploading…" (a percentage when the
 *    caller reports one through `setProgress`), then "Uploaded" — or, with `onSelect` instead, hands
 *    the file to a form that sends it on Save;
 * 5. shows a thumbnail for an image and the name and size for anything else;
 * 6. clears the input whatever happened, so the same file can always be picked again.
 *
 *     <FileUpload label="Bill copy" onUpload={(f) => uploadBill(id, f.base64, f.fileName)} />
 *     <FileUpload label="Photo" accept="image/*" onSelect={setPhoto} />
 */
export default function FileUpload({
  label,
  hint,
  accept = ACCEPT_IMAGES_AND_PDF,
  maxBytes = MAX_UPLOAD_BYTES,
  compress = true,
  maxDimension = 2048,
  quality = 0.8,
  onUpload,
  onSelect,
  onUploaded,
  disabled = false,
  id: idProp,
  className,
}: {
  label: string;
  /** Shown under the control; defaults to the accepted types and the limit. */
  hint?: string;
  accept?: string;
  maxBytes?: number;
  /** Shrink photos before sending. Off for an image whose pixels matter exactly. */
  compress?: boolean;
  maxDimension?: number;
  quality?: number;
  /**
   * Sends the file now. Throw to report a failure; the server's message is shown. Call
   * `setProgress(fraction)` if the transport can report it (an XHR upload).
   */
  onUpload?: (
    file: PreparedFile,
    setProgress: (fraction: number) => void,
  ) => Promise<unknown>;
  /** Hands the file to a form instead of sending it; `null` when it is removed. */
  onSelect?: (file: PreparedFile | null) => void;
  /** After a successful `onUpload`, with what it returned. */
  onUploaded?: (result: unknown) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const hintId = `${id}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [picked, setPicked] = useState<PreparedFile | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // The thumbnail's object URL is released when it is replaced or the control goes away.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const busy = stage === 'preparing' || stage === 'uploading';

  const reset = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const fail = (message: string) => {
    setError(message);
    setStage('error');
    setProgress(null);
  };

  const onChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const original = event.target.files?.[0];
    // Cleared at once: the same file picked again after any outcome must fire `change` again.
    reset();
    if (!original) return;
    setError(null);

    if (!matchesAccept(original, accept)) {
      fail(`“${original.name}” isn’t a kind of file this accepts.`);
      return;
    }

    setStage('preparing');
    try {
      const file =
        compress && original.type.startsWith('image/')
          ? await compressImage(original, { maxDimension, quality })
          : original;
      // After compression: a 14 MB photo that shrinks to 600 KB is fine to send.
      if (file.size > maxBytes) {
        fail(
          `“${original.name}” is ${formatBytes(file.size)}. The limit is ${formatBytes(maxBytes)}.`,
        );
        return;
      }
      const prepared: PreparedFile = {
        file,
        base64: await fileToBase64(file),
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        originalSize: original.size,
      };
      setPicked(prepared);
      setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);

      if (!onUpload) {
        onSelect?.(prepared);
        setStage('done');
        return;
      }
      setStage('uploading');
      setProgress(null);
      const result = await onUpload(prepared, (fraction) =>
        setProgress(Math.max(0, Math.min(1, fraction))),
      );
      setStage('done');
      setProgress(null);
      onUploaded?.(result);
    } catch (err) {
      fail(errorMessage(err, 'The file could not be uploaded. Please try again.'));
    }
  };

  const remove = () => {
    setPicked(null);
    setPreview(null);
    setError(null);
    setStage('idle');
    onSelect?.(null);
  };

  const status =
    stage === 'preparing'
      ? 'Preparing…'
      : stage === 'uploading'
        ? progress === null
          ? 'Uploading…'
          : `Uploading… ${Math.round(progress * 100)}%`
        : stage === 'done'
          ? onUpload
            ? 'Uploaded'
            : 'Ready'
          : null;

  return (
    <div className={clsx('space-y-2', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={clsx(
            'inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-500',
            (disabled || busy) && 'pointer-events-none opacity-50',
          )}
        >
          {busy ? (
            <Spinner />
          ) : (
            <ArrowUpTrayIcon aria-hidden="true" className="h-4 w-4" />
          )}
          {picked ? 'Choose another file' : 'Choose a file'}
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={accept}
            disabled={disabled || busy}
            aria-describedby={hintId}
            onChange={onChange}
            // Visually hidden; the label around it is the target, and still takes keyboard focus.
            className="sr-only"
          />
        </label>
        {status && (
          <span
            role="status"
            className={clsx(
              'inline-flex items-center gap-1.5 text-sm',
              stage === 'done' ? 'text-green-700' : 'text-gray-600',
            )}
          >
            {stage === 'done' && (
              <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
            )}
            {status}
          </span>
        )}
      </div>

      {stage === 'uploading' && progress !== null && (
        <div
          className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label={`Uploading ${picked?.fileName ?? 'file'}`}
        >
          <div
            className="h-full bg-brand-600 transition-[width]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      {picked && (
        <div className="flex max-w-md items-center gap-3 rounded-lg border border-gray-200 bg-white p-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an asset.
            <img
              src={preview}
              alt=""
              className="h-12 w-12 shrink-0 rounded object-cover"
            />
          ) : (
            <DocumentIcon
              aria-hidden="true"
              className="h-10 w-10 shrink-0 text-gray-400"
            />
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate text-gray-900">{picked.fileName}</p>
            <p className="text-xs text-gray-500">
              {formatBytes(picked.size)}
              {picked.size < picked.originalSize &&
                ` (from ${formatBytes(picked.originalSize)})`}
            </p>
          </div>
          {!onUpload && !busy && (
            <IconButton
              size="sm"
              label={`Remove ${picked.fileName}`}
              onClick={remove}
            >
              <XMarkIcon aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          )}
        </div>
      )}

      {error ? (
        <p id={hintId} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : (
        <p id={hintId} className="text-xs text-gray-500">
          {hint ??
            (accept === ACCEPT_IMAGES_AND_PDF
              ? `PDF or image, up to ${formatBytes(maxBytes)}.`
              : `Up to ${formatBytes(maxBytes)}.`)}
        </p>
      )}
    </div>
  );
}
