'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import {
  type DwrAttachment,
  addDwrAttachment,
  downloadDwrAttachment,
} from '@/app/lib/api/dwr';
import { openStoredFile } from '@/app/lib/download-file';
import { Button } from '@/app/ui/button';
import { RowAction } from '@/app/ui/settings/form-fields';

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
}: {
  dwrId: string;
  attachments: DwrAttachment[];
}) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => addDwrAttachment(dwrId, file),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['dwr', dwrId] });
      if (input.current) input.current.value = '';
    },
    onError: (err: Error) => setError(err.message),
  });

  const open = async (attachment: DwrAttachment) => {
    setError(null);
    try {
      // The server's own name for the file, with its extension. The fallback is reached only if
      // the response carried no readable Content-Disposition — see `openStoredFile`.
      openStoredFile(
        await downloadDwrAttachment(attachment.id),
        attachment.fileName,
      );
    } catch {
      setError('That attachment could not be opened.');
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Evidence
        </h3>
        <div className="flex items-center gap-2">
          <input
            ref={input}
            type="file"
            className="text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />
          <Button type="button" disabled={upload.isPending}>
            {upload.isPending ? 'Attaching…' : 'Attach'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {attachments.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
          Nothing attached. The measurement sheet signed on site is what settles a
          quantity somebody later disputes.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span className="truncate">{attachment.fileName}</span>
              <span className="flex items-center gap-3 whitespace-nowrap text-xs text-gray-500">
                {Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB
                <RowAction
                  type="button"
                  intent="read"
                  onClick={() => void open(attachment)}
                >
                  Open
                </RowAction>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
