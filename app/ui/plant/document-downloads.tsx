'use client';

import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import type { DocumentFormat } from '@/app/lib/api/plant-hire';
import { saveBlob } from '@/app/lib/download-file';
import { RowAction } from '@/app/ui/settings/form-fields';

const FORMATS: [DocumentFormat, string][] = [
  ['pdf', 'PDF'],
  ['docx', 'Word'],
  ['xlsx', 'Excel'],
];

/**
 * PDF / Word / Excel for one of the client's plant documents (2026-10-15).
 *
 * The same three controls the debit-notes panel offers, drawn as row actions so they sit
 * in a list row's action strip. Each is a read: a viewer without write access still gets
 * the document. One download at a time — the server renders each file on request, and a
 * second click while the first renders would only queue a duplicate.
 */
export default function DocumentDownloads({
  load,
  onError,
}: {
  load: (format: DocumentFormat) => Promise<{ blob: Blob; filename: string }>;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState<DocumentFormat | null>(null);

  return (
    <>
      {FORMATS.map(([format, label]) => (
        <RowAction
          key={format}
          type="button"
          intent="read"
          disabled={busy !== null}
          onClick={() => {
            setBusy(format);
            load(format)
              .then(({ blob, filename }) => saveBlob(blob, filename))
              .catch((err: unknown) =>
                onError(
                  err instanceof ApiError
                    ? err.message
                    : `Could not download the ${label} file.`,
                ),
              )
              .finally(() => setBusy(null));
          }}
        >
          {busy === format ? `${label}…` : label}
        </RowAction>
      ))}
    </>
  );
}
