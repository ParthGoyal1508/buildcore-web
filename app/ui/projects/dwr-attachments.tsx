'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { errorMessage } from '@/app/lib/api/client';
import {
  type DwrAttachment,
  addDwrAttachment,
  downloadDwrAttachment,
  dwrAttachmentThumbnail,
  removeDwrAttachment,
} from '@/app/lib/api/dwr';
import { compressImage, formatBytes } from '@/app/lib/files';
import { confirmDialog } from '@/app/ui/dialogs';
import FileUpload from '@/app/ui/file-upload';
import { useFileViewer } from '@/app/ui/pdf-viewer';
import {
  projectErrorMessage,
  useProjectLock,
} from '@/app/ui/projects/project-lock-context';
import { RowAction } from '@/app/ui/settings/form-fields';
import { useToast } from '@/app/ui/toast';

/**
 * Evidence on a daily work report (025 FR-025).
 *
 * ## Why this is the gap worth closing first
 *
 * A measured quantity is an argument. The site says 20 cubic metres, the client's engineer says
 * fewer, and what settles it is the sheet somebody signed on the day — the one that was photographed
 * on a phone at the edge of the carriageway. Both endpoints for that have existed since feature
 * 022, tested, and no screen has ever called either, so the evidence lived on the phone.
 *
 * ## Two details that are the server's, not this screen's
 *
 * The content type is detected from the **bytes** and the file name is stored as the uploader's own
 * filesystem spells it, so a download arrives named and openable rather than as a bare storage
 * reference. This component passes the name through and does not invent one.
 */
export default function DwrAttachments({
  dwrId,
  attachments,
  sealed,
  removable = false,
}: {
  dwrId: string;
  /**
   * **Report-level only.** Filtered by the caller, not here: the lines table renders
   * the rest beside the measurements they are evidence for, and a component that
   * filtered its own input would leave the caller unable to say which half it wanted.
   */
  attachments: DwrAttachment[];
  /**
   * The report is approved, so it takes no further evidence (2026-10-12).
   *
   * What is already filed stays readable — this hides the way to add, not the record. The API
   * refuses the upload as well; this is so nobody is offered an action that would be refused.
   */
  sealed?: boolean;
  /**
   * The report is a draft or returned, so a wrong file may be taken off it (036 I9). The API
   * refuses the removal on any other status; this only decides whether to offer it.
   */
  removable?: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isLocked } = useProjectLock();
  const [error, setError] = useState<string | null>(null);
  // A PDF or a photo opens in the page's own viewer (2026-10-14) rather than a new tab, which most
  // browsers block when it is opened after a fetch; any other file is still saved.
  const { show, viewer } = useFileViewer();

  const remove = useMutation({
    mutationFn: (attachment: DwrAttachment) =>
      removeDwrAttachment(dwrId, attachment.id),
    onSuccess: (_result, attachment) => {
      setError(null);
      toast.success(`Removed ${attachment.fileName}.`);
      void queryClient.invalidateQueries({ queryKey: ['dwr', dwrId] });
    },
    onError: (err: unknown) =>
      setError(projectErrorMessage(err, 'The file could not be removed.')),
  });

  const open = async (attachment: DwrAttachment) => {
    setError(null);
    try {
      // The server's own name for the file, with its extension. The fallback is reached only if
      // the response carried no readable Content-Disposition — see `openStoredFile`.
      show(
        await downloadDwrAttachment(attachment.id),
        attachment.fileName,
      );
    } catch (err) {
      // 036 I9: the server's reason, not a blanket "could not be opened".
      setError(errorMessage(err, 'That attachment could not be opened.'));
    }
  };

  const confirmRemove = async (attachment: DwrAttachment) => {
    if (
      await confirmDialog({
        title: 'Remove this file?',
        message: `Remove “${attachment.fileName}” from the report? The removal is recorded.`,
        confirmLabel: 'Remove',
        tone: 'danger',
      })
    ) {
      remove.mutate(attachment);
    }
  };

  const canAdd = !sealed && !isLocked;
  const canRemove = removable && !sealed && !isLocked;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Evidence
        </h3>
        {sealed && (
          <span className="text-xs text-gray-500">
            Approved — reverse the report to file anything further.
          </span>
        )}
      </div>

      {/* 036 I9: the shared upload control. The old "Attach" button had no onClick — only the
          bare input beside it worked — a second pick could start while one was uploading, and a
          failure showed nothing useful. This checks type and size first, shrinks a photo, is
          disabled while it sends, and says the server's reason when it fails. */}
      {canAdd && (
        <FileUpload
          label="Attach to the report"
          hint="A photo or PDF for the whole day — the signed measurement sheet, a general site view. Up to 10 MB."
          onUpload={(file) => addDwrAttachment(dwrId, file.file)}
          onUploaded={() => {
            setError(null);
            toast.success('Attached.');
            void queryClient.invalidateQueries({ queryKey: ['dwr', dwrId] });
          }}
        />
      )}

      {viewer}
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {attachments.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
          Nothing attached to the report itself.{' '}
          {sealed
            ? 'This report is approved, so nothing further can be filed against it.'
            : 'A photograph of one pour belongs on its own line, in the table above; this is for what covers the whole day — the signed measurement sheet, a general site view.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-3">
                <AttachmentThumb
                  attachment={attachment}
                  onOpen={() => void open(attachment)}
                />
                <span className="truncate">{attachment.fileName}</span>
              </span>
              <span className="flex items-center gap-3 whitespace-nowrap text-xs text-gray-500">
                {formatBytes(attachment.sizeBytes)}
                <RowAction
                  type="button"
                  intent="read"
                  onClick={() => void open(attachment)}
                >
                  Open
                </RowAction>
                {canRemove && (
                  <RowAction
                    type="button"
                    loading={
                      remove.isPending && remove.variables?.id === attachment.id
                    }
                    disabled={remove.isPending}
                    onClick={() => void confirmRemove(attachment)}
                  >
                    Remove
                  </RowAction>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * A photo's thumbnail, 44 px, opening the full file on tap (036 I8).
 *
 * Fetched as a blob through the authenticated client — an `<img src>` to the API would carry no
 * token. Kept for the session (`staleTime: Infinity`): a thumbnail never changes for its id.
 */
function AttachmentThumb({
  attachment,
  onOpen,
}: {
  attachment: DwrAttachment;
  onOpen: () => void;
}) {
  const isImage = attachment.mimeType.startsWith('image/');
  const thumb = useQuery({
    queryKey: ['dwr-attachment-thumb', attachment.id],
    queryFn: async () =>
      URL.createObjectURL(await dwrAttachmentThumbnail(attachment.id)),
    enabled: isImage,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  if (!isImage) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500">
        {attachment.mimeType === 'application/pdf' ? 'PDF' : 'FILE'}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${attachment.fileName}`}
      className="h-11 w-11 shrink-0 overflow-hidden rounded bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
    >
      {thumb.data && (
        // eslint-disable-next-line @next/next/no-img-element -- an authenticated blob URL, not an asset.
        <img src={thumb.data} alt="" className="h-full w-full object-cover" />
      )}
    </button>
  );
}

/**
 * The same upload, scoped to one measurement line (2026-10-11).
 *
 * A thin control rather than a second screen: a photograph of one pour is evidence for
 * *that* line, and twenty files in a list under the report is what it was before — a
 * pile nobody can tie to the chainage being argued about.
 *
 * Deliberately not a copy of the component above. It shares the mutation, the cache key
 * and the open-by-name behaviour; what differs is that it has one row to show and no
 * heading, because it lives inside a table cell.
 */
export function DwrLinePhotos({
  dwrId,
  taskId,
  attachments,
  sealed,
}: {
  dwrId: string;
  taskId: string;
  /** Already filtered to this line by the caller. */
  attachments: DwrAttachment[];
  /** The report is approved. See {@link DwrAttachments}. */
  sealed?: boolean;
}) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  // A PDF or a photo opens in the page's own viewer (2026-10-14) rather than a new tab, which most
  // browsers block when it is opened after a fetch; any other file is still saved.
  const { show, viewer } = useFileViewer();

  const { isLocked } = useProjectLock();
  const upload = useMutation({
    // 036 I8: shrunk before it is sent, as everywhere else a photo is picked.
    mutationFn: async (file: File) =>
      addDwrAttachment(dwrId, await compressImage(file), taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dwr', dwrId] });
      if (input.current) input.current.value = '';
    },
    onError: () => {
      if (input.current) input.current.value = '';
    },
  });

  const open = async (attachment: DwrAttachment) => {
    try {
      show(
        await downloadDwrAttachment(attachment.id),
        attachment.fileName,
      );
    } catch {
      // Silent here on purpose: the cell has no room for an error banner, and the
      // report-level section above reports the same failure with somewhere to put it.
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      {viewer}
      {attachments.map((attachment) => (
        <RowAction
          key={attachment.id}
          type="button"
          intent="read"
          onClick={() => void open(attachment)}
        >
          {attachment.fileName}
        </RowAction>
      ))}
      {/* Nothing offered on an approved report — not a disabled control, which reads as something
          that might work later. What is already filed above stays openable. */}
      {!sealed && !isLocked && (
        /*
          **The input covers the label rather than being `sr-only`** (2026-10-12).

          `sr-only` is `position: absolute` at 1px square, and clicking a label focuses the input
          it wraps — so the browser scrolled an ancestor to bring that 1px box into view. In this
          table the ancestor it chose was the dashboard shell, which clips without a scrollbar:
          the sidebar slid off, everything shifted ~770px left, and there was no way to scroll
          back. Sized to the label, the input is already where the person just clicked, so there
          is nothing to scroll to. It stays a real focusable input with its name from the label.
        */
        <label className="relative inline-flex min-h-[44px] cursor-pointer items-center text-xs text-brand-600 hover:underline focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-500">
          {upload.isPending ? 'Attaching…' : '+ Photo'}
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            disabled={upload.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />
        </label>
      )}
      {upload.isError && (
        <span className="text-xs text-red-700" role="alert">
          {projectErrorMessage(upload.error, 'Could not attach that file.')}
        </span>
      )}
    </div>
  );
}
