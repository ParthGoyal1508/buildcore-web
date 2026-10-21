'use client';

import { PaperClipIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';

import {
  getApprovalFile,
  listApprovalFiles,
  type ApprovalFile,
} from '@/app/lib/api/approvals';
import type { useFileViewer } from '@/app/ui/pdf-viewer';
import { RowAction } from '@/app/ui/settings/form-fields';

/**
 * The files behind one item in the approval queue, each opening in place (2026-10-20: "when we
 * were approving we were not seeing any attachment that the user has uploaded").
 *
 * Asked of the server per row rather than decided here from the action type: which items carry
 * files is the owning module's knowledge, and a second mapping on this side would be wrong first
 * for whichever module was added last — the reason the queue already takes `subject` and `href`
 * from the server. Renders nothing for an item with none, or while the list loads.
 */
export default function ApprovalFiles({
  entityType,
  entityId,
  subject,
  view,
}: {
  entityType: string;
  entityId: string;
  subject: string;
  view: ReturnType<typeof useFileViewer>['view'];
}) {
  const { data } = useQuery({
    queryKey: ['approvalFiles', entityType, entityId],
    queryFn: () => listApprovalFiles(entityType, entityId),
    // An item's files do not change while it waits; the queue refetching on focus need not
    // re-ask for every row's.
    staleTime: 5 * 60_000,
  });
  if (!data?.length) return null;

  const open = (file: ApprovalFile) =>
    void view({
      title: `${file.name} · ${subject}`,
      fileName: file.name,
      load: () => getApprovalFile(entityType, entityId, file.key),
    });

  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {data.map((file) => (
        <RowAction
          key={file.key}
          type="button"
          intent="read"
          onClick={() => open(file)}
        >
          <PaperClipIcon aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="max-w-[12rem] truncate">{file.name}</span>
        </RowAction>
      ))}
    </div>
  );
}
