import { dateTimeLabel } from '@/app/lib/format';
import type { Dwr } from '@/app/lib/api/dwr';

/**
 * What a reviewer sent a daily work report back for (028).
 *
 * **One component for both screens that need it**, the report and the edit form, because they are
 * two halves of one act: the author reads the complaint on the report and has to still be able to
 * read it while typing the correction. Two copies of this markup is how the two screens come to
 * say different things about the same return.
 *
 * Renders nothing for a report that was not returned, so a caller can place it unconditionally.
 * The reason is required by the API, so there is always a sentence to print — a banner reading
 * "returned, no reason given" would be the original defect in a new colour: the reviewer typed a
 * reason into a prompt, the web sent it, and a route that read no body threw it away.
 */
export default function DwrReturnedNotice({ report }: { report: Dwr }) {
  if (report.status !== 'returned') return null;

  return (
    <div
      className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
      role="status"
    >
      <p className="font-medium">
        Sent back for correction
        {report.returnedByName ? ` by ${report.returnedByName}` : ''}
        {report.returnedAt ? ` on ${dateTimeLabel(report.returnedAt)}` : ''}.
      </p>
      {report.returnReason && (
        <p className="mt-1 whitespace-pre-line">{report.returnReason}</p>
      )}
      <p className="mt-1 text-xs text-amber-800">
        Edit it as you would a draft, then submit it again. Nothing has moved
        onto the BOQ, because submission never moved anything.
      </p>
    </div>
  );
}
