'use client';

import { uploadCountersigned } from '@/app/lib/api/letters';
import FileUpload from '@/app/ui/file-upload';
import { useToast } from '@/app/ui/toast';

/**
 * The executed copy that comes back signed by the other party (017 FR-012, backend FR-017).
 *
 * The issued copy keeps its own file and is not replaced. "We sent this" and "they signed
 * it" are different claims about the world, and a screen that overwrote the first with
 * the second would lose the ability to show what was actually sent — which is the half
 * that matters when the two disagree.
 *
 * 036 J4 (2026-10-17): the shared picker, uploading as soon as a file is chosen. The bare
 * `<input type="file">` this replaced took any file of any size, said nothing while it sent a
 * scan, and could not be given the same file again after a failure. A photographed signature
 * page is shrunk before it goes; the server's refusal, if any, is shown under the control.
 */
export function CountersignUpload({
  letterId,
  onUploaded,
}: {
  letterId: string;
  onUploaded?: () => void;
}) {
  const toast = useToast();
  return (
    <FileUpload
      label="Executed copy"
      onUpload={(file) =>
        uploadCountersigned(letterId, {
          data: file.base64,
          contentType: file.mimeType,
        })
      }
      onUploaded={() => {
        toast.success('The executed copy has been attached.');
        onUploaded?.();
      }}
    />
  );
}
