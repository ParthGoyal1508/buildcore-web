'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { saveBlob } from '@/app/lib/download-file';

/**
 * Reading a PDF in the page, without saving it first (2026-10-14).
 *
 * Letters were the first screen to show their PDF in the page — a draft read beside the form it came
 * from — and the ask that followed was "the same, wherever there is a PDF": a bill, a payslip, a
 * payment advice, an uploaded certificate. Saving a file to read it once leaves a Downloads folder of
 * `RA-12 (3).pdf`s, and a new tab opened after a request is one most browsers block as a pop-up, so
 * every screen opens the same in-page viewer instead.
 *
 * ## Why a blob, and not the endpoint's URL in the iframe
 *
 * Every document endpoint is behind the bearer token, which an `<iframe src>` cannot send. So the
 * file is fetched the way the Download button already fetches it — through the authenticated client,
 * refresh-on-401 included — and shown from an object URL. A blob URL also ignores the endpoint's
 * `Content-Disposition: attachment`, which is what would otherwise turn "View" into a download.
 *
 * ## The type is decided here, not trusted from the response
 *
 * A few endpoints answer `application/octet-stream`, and a browser handed an octet-stream blob in an
 * iframe saves it — the very thing View exists to avoid. View is only offered for a PDF or an image,
 * so a blob without a renderable type is re-labelled from its file name, and a PDF when the name says
 * nothing either.
 */

/** A file as the API layer returns it: the bytes, and the name the server gave them if any. */
export interface ViewableFile {
  blob: Blob;
  filename?: string | null;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

function extensionOf(name?: string | null): string {
  const match = name?.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

/**
 * Whether a stored document can be shown in the viewer — for an upload of unknown type, where the
 * row offers View only when it is a PDF or an image. Either the MIME type or the name is enough.
 */
export function isViewableFile(
  mimeType?: string | null,
  fileName?: string | null,
): boolean {
  const type = (mimeType ?? '').split(';')[0].trim().toLowerCase();
  if (type === 'application/pdf' || type.startsWith('image/')) return true;
  const ext = extensionOf(fileName);
  return ext === 'pdf' || ext in IMAGE_EXTENSIONS;
}

/** The blob with a type the browser renders, from its own type, else its name, else PDF. */
function renderable(file: ViewableFile): { blob: Blob; isImage: boolean } {
  const type = file.blob.type.split(';')[0].trim().toLowerCase();
  if (type.startsWith('image/')) return { blob: file.blob, isImage: true };
  if (type === 'application/pdf') return { blob: file.blob, isImage: false };
  const imageType = IMAGE_EXTENSIONS[extensionOf(file.filename)];
  if (imageType) {
    return { blob: new Blob([file.blob], { type: imageType }), isImage: true };
  }
  return {
    blob: new Blob([file.blob], { type: 'application/pdf' }),
    isImage: false,
  };
}

/**
 * The document itself — an iframe for a PDF, an `<img>` for an image. The object URL lives exactly as
 * long as the blob it was made from is on screen, and is released when either changes or the viewer
 * closes.
 */
function FileFrame({
  file,
  title,
  className,
}: {
  file: ViewableFile;
  title: string;
  className: string;
}) {
  const shown = useMemo(() => renderable(file), [file]);
  const url = useMemo(() => URL.createObjectURL(shown.blob), [shown]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  if (shown.isImage) {
    return (
      <div className={`overflow-auto ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a blob URL, which next/image cannot optimise */}
        <img src={url} alt={title} className="mx-auto max-w-full" />
      </div>
    );
  }
  return <iframe title={title} src={url} className={className} />;
}

/**
 * A PDF shown inline, in the flow of the page (2026-10-14) — the letters' draft preview, read beside
 * the form it came from rather than over it. Moved here from the letters panel unchanged, so the
 * modal viewer and the preview render a document the same way.
 */
export function PdfPreview({
  title,
  blob,
  onClose,
  note = 'A draft: no reference number, and the signature is applied only when the letter is issued.',
}: {
  title: string;
  blob: Blob;
  onClose: () => void;
  note?: string | null;
}) {
  const file = useMemo(() => ({ blob, filename: null }), [blob]);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-blue-700 underline"
        >
          Close preview
        </button>
      </div>
      {note && <p className="text-xs text-gray-500">{note}</p>}
      <FileFrame
        file={file}
        title={title}
        className="h-[75vh] w-full rounded border border-gray-200"
      />
    </div>
  );
}

type ViewerState = {
  title: string;
  fallbackName: string;
} & (
  | { status: 'loading' }
  | { status: 'ready'; file: ViewableFile }
  | { status: 'error'; message: string }
);

/**
 * The viewer as a dialog over the page: the document, its title, Download and Close. Escape closes
 * it, as it does every other dialog here, and focus goes back to the View button that opened it.
 *
 * Portalled to `<body>`, and its Escape listened for on `window` in the capture phase: View is also
 * offered inside dialogs (a letter just issued, a payment advice), and those listen for Escape on
 * `document`. Window capture runs first, so Escape closes the viewer and stops there, rather than
 * also closing the dialog underneath it.
 */
export function FileViewer({
  state,
  onClose,
}: {
  state: ViewerState;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/50 p-0 sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-viewer-title"
        className="flex w-full max-w-5xl flex-col overflow-hidden bg-white shadow-xl sm:rounded-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2
            id="file-viewer-title"
            className="min-w-0 truncate text-base font-medium text-gray-900"
          >
            {state.title}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {state.status === 'ready' && (
              <button
                type="button"
                onClick={() =>
                  saveBlob(
                    state.file.blob,
                    state.file.filename || state.fallbackName,
                  )
                }
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Download
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex min-h-11 min-w-11 items-center justify-center rounded text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 sm:min-h-0 sm:min-w-0 sm:p-1"
            >
              <XMarkIcon className="w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col bg-gray-100">
          {state.status === 'loading' && (
            <p className="m-auto text-sm text-gray-600" role="status">
              Opening the document…
            </p>
          )}
          {state.status === 'error' && (
            <p
              className="m-auto max-w-md rounded-md bg-red-50 p-3 text-sm text-red-800"
              role="alert"
            >
              {state.message}
            </p>
          )}
          {state.status === 'ready' && (
            <FileFrame
              file={state.file}
              title={state.title}
              className="h-full min-h-[70vh] w-full flex-1 border-0"
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** What a screen asks the viewer to show: a title, a name to save it under, and how to fetch it. */
export interface ViewRequest {
  title: string;
  /** The name Download saves under when the server sent none. */
  fileName: string;
  load: () => Promise<Blob | ViewableFile>;
}

/**
 * The viewer for one screen: `view(...)` opens it and fetches the document, `viewer` is the element
 * to render. The dialog opens at once with "Opening the document…" rather than after the fetch, so a
 * slow PDF still answers the click; a fetch that finishes after the viewer was closed, or after
 * another View was clicked, is dropped.
 */
export function useFileViewer() {
  const [state, setState] = useState<ViewerState | null>(null);
  const request = useRef(0);

  const close = useCallback(() => {
    request.current += 1;
    setState(null);
  }, []);

  const view = useCallback(async ({ title, fileName, load }: ViewRequest) => {
    const id = ++request.current;
    setState({ title, fallbackName: fileName, status: 'loading' });
    try {
      const loaded = await load();
      if (id !== request.current) return;
      const file =
        loaded instanceof Blob ? { blob: loaded, filename: null } : loaded;
      setState({ title, fallbackName: fileName, status: 'ready', file });
    } catch (err) {
      if (id !== request.current) return;
      setState({
        title,
        fallbackName: fileName,
        status: 'error',
        message:
          err instanceof Error && err.message
            ? err.message
            : 'That document could not be opened.',
      });
    }
  }, []);

  /**
   * The in-page stand-in for `openStoredFile` — same arguments, for an upload already fetched. A PDF
   * or an image opens in the viewer instead of a new tab; anything else (a workbook, a Word file) is
   * saved under the server's name, exactly as before, because there is nothing a frame could show.
   */
  const show = useCallback(
    (file: ViewableFile, fallbackName: string, title?: string) => {
      request.current += 1;
      const name = file.filename || fallbackName;
      if (!isViewableFile(file.blob.type, name)) {
        saveBlob(file.blob, name);
        return;
      }
      setState({
        title: title ?? name,
        fallbackName,
        status: 'ready',
        file,
      });
    },
    [],
  );

  const viewer = state ? <FileViewer state={state} onClose={close} /> : null;
  return { view, show, viewer };
}
