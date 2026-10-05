'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getReconciliation,
  repairReconciliation,
} from '@/app/lib/api/dwr';
import { Button } from '@/app/ui/button';

/**
 * Where the BOQ's executed quantity disagrees with the sum of approved reports (025 FR-027).
 *
 * ## What this answers
 *
 * Every BOQ line carries a stored executed quantity, incremented when a report is approved. That
 * counter is a **cache**; the sum of approved measurement is the record. A denormalised total with
 * no way to check it is a total whose drift is discovered at a month-end, by which time it has been
 * billed.
 *
 * The tolerance is **exact**. Both figures are decimal to three places and every increment is
 * exact, so any non-zero difference is a defect rather than rounding, and there is no threshold
 * here to tune.
 *
 * ## Repair is deliberate, and this screen must not make it convenient
 *
 * A discrepancy is the only symptom of whatever moved the counter without a report. Repairing it
 * destroys that evidence, so the server requires a written reason of real length and records the
 * previous value — and this screen asks for the reason rather than sending a placeholder, and never
 * repairs anything on load. A report that healed itself when opened would mean nobody ever found
 * the fault.
 */
export default function DwrReconciliation({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dwr-reconciliation', projectId],
    queryFn: () => getReconciliation(projectId),
  });

  const repair = useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason: string }) =>
      repairReconciliation(projectId, ids, reason),
    onSuccess: (result) => {
      setError(null);
      setNotice(
        `${result.repaired.length} line(s) set back to the approved measurement.`,
      );
      void queryClient.invalidateQueries({
        queryKey: ['dwr-reconciliation', projectId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'boq'],
      });
    },
    onError: (err: Error) => {
      setNotice(null);
      setError(err.message);
    },
  });

  if (isLoading) {
    return (
      <p className="text-sm text-gray-500" role="status">
        Checking the counters…
      </p>
    );
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-red-700" role="alert">
        The reconciliation could not be read.
      </p>
    );
  }

  const drifted = data.lines.filter((line) => Number(line.difference) !== 0);

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-semibold text-gray-900">
          Counters against the record
        </h2>
        <p className="text-sm text-gray-600">
          Every BOQ line&rsquo;s stored executed quantity beside the sum of its
          approved daily work. They should agree exactly — any difference at all
          is a defect, not rounding.
        </p>
      </header>

      {notice && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {drifted.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-600">
          All {data.lines.length} line(s) agree. Checked across every line, not
          only the ones somebody suspected.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">BOQ No.</th>
                <th className="px-3 py-2 text-right">Counter</th>
                <th className="px-3 py-2 text-right">Approved</th>
                <th className="px-3 py-2 text-right">Difference</th>
                <th className="px-3 py-2 text-right">Repair</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {drifted.map((line) => (
                <tr key={line.boqItemId}>
                  <td className="px-3 py-2">{line.boqNo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {line.doneQty}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {line.approvedSum}
                  </td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums text-amber-800">
                    {line.difference}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      disabled={repair.isPending}
                      onClick={() => {
                        const reason = window.prompt(
                          'Say what drifted and why the counter is the wrong figure. A repair overwrites it, and the previous value is recorded.',
                        );
                        if (reason) {
                          repair.mutate({ ids: [line.boqItemId], reason });
                        }
                      }}
                    >
                      Set to approved
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
