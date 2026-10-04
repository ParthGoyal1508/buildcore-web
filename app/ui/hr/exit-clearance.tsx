'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ApiError } from '@/app/lib/api/client';
import {
  CLEARANCE_KINDS,
  WAIVER_REASON_MIN_LENGTH,
  getExitClearance,
  requestClearanceWaiver,
  type ClearanceItem,
  type ClearanceKind,
} from '@/app/lib/api/exit-clearance';
import { getCurrentUser, hasWrite } from '@/app/lib/api/users';
import { CLEARANCE_COPY, MESSAGES, ROUTES } from '@/app/lib/constants';
import { dateTimeLabel } from '@/app/lib/format';
import { Button } from '@/app/ui/button';
import {
  FormError,
  RowAction,
  SecondaryButton,
} from '@/app/ui/settings/form-fields';
import Modal from '@/app/ui/settings/modal';

/**
 * Nobody leaves holding the company's property (021 US4, FR-012 to FR-014) — item 10.
 *
 * ## Everything here is read, nothing is recomputed
 *
 * The clearance is derived on the server from the modules that own each obligation, and
 * only waivers are stored. Two consequences shape this screen:
 *
 * - **`settleable` is read, never derived from `items`.** The backend holds it false while
 *   any source could not be asked, because the safe answer to "is anything outstanding?"
 *   when part of the question went unanswered is "assume yes". Recomputing it here from the
 *   items present would offer settlement on an incomplete picture — which is the one failure
 *   that lets somebody leave with a laptop.
 * - **No control here returns anything.** An asset returned through the asset register
 *   satisfies its item with no second action, so this screen links out and never writes. A
 *   return control here would be a second way to close an allocation and the two would
 *   disagree (FR-012b).
 *
 * ## A waiver is not a discharge
 *
 * It records that the company stopped chasing the obligation, with a name and a reason
 * against the decision. The asset stays open in the asset register, deliberately: marking it
 * returned would put a false fact in the register that owns the truth. So a waived item is
 * rendered as waived, never as settled.
 */
export default function ExitClearance({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const [waiving, setWaiving] = useState<ClearanceItem | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
  });

  /**
   * `PAYROLL` at **write** — may *propose* a waiver (T052, changed 2026-10-02).
   *
   * `hasWrite(user, 'EMPLOYEES')` was a placeholder chosen while building, and the client has now
   * set the authority deliberately: proposing is an HR act. Write access on employee records is held
   * by more people than HR, and a write-off of company money is not something a site administrator
   * should be able to put in front of the Director alone. `PAYROLL` is the HR-office permission in
   * this product — it is what gates the salary data a waived advance comes out of — and the backend
   * gates `waive()` on exactly the same value.
   *
   * At **write**, not merely held: `permissions` means "holds the area at some level" by design, so
   * gating on it would offer the control to every reader with the server's 403 as the only thing
   * stopping them.
   *
   * Absent, not disabled. A disabled button still advertises an authority the reader has not got.
   */
  const mayPropose = hasWrite(user, 'PAYROLL');

  const clearance = useQuery({
    queryKey: ['hr', 'employee', employeeId, 'exit-clearance'],
    queryFn: () => getExitClearance(employeeId),
    // A 404 means no exit has been initiated, which is a normal state for most employees
    // rather than a failure worth retrying.
    retry: false,
  });

  const waive = useMutation({
    mutationFn: (item: ClearanceItem) =>
      requestClearanceWaiver(employeeId, {
        kind: item.kind,
        ref: item.ref,
        reason: reason.trim(),
      }),
    onSuccess: async () => {
      setWaiving(null);
      setReason('');
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ['hr', 'employee', employeeId, 'exit-clearance'],
      });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError ? err.message : CLEARANCE_COPY.waiveFailed,
      ),
  });

  if (clearance.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        {CLEARANCE_COPY.loading}
      </p>
    );
  }
  if (clearance.isError) {
    // A 404 is "no exit initiated" and reads as a fact; anything else is a failure.
    const notFound =
      clearance.error instanceof ApiError && clearance.error.status === 404;
    return (
      <p
        className={notFound ? 'text-sm text-gray-500' : 'text-sm text-red-700'}
        role={notFound ? 'status' : 'alert'}
      >
        {notFound ? CLEARANCE_COPY.noExit : MESSAGES.loadFailed}
      </p>
    );
  }

  const data = clearance.data;
  const unavailable = data.unavailableSources
    .map(
      (kind) =>
        CLEARANCE_COPY.groups[kind as ClearanceKind] ?? kind,
    )
    .join(', ');

  /**
   * Grouped by kind, keeping only kinds with items.
   *
   * Grouped **by consequence rather than by module**: an asset has a site, a due date and a
   * physical location, which is a different kind of obligation from money owed, and the
   * person clearing an exit needs to see at a glance what physical property is outstanding
   * (FR-012a).
   */
  const groups = CLEARANCE_KINDS.map((kind) => ({
    kind,
    items: data.items.filter((item) => item.kind === kind),
  })).filter((group) => group.items.length > 0);

  const reasonTooShort = reason.trim().length < WAIVER_REASON_MIN_LENGTH;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-medium text-gray-900">
          {CLEARANCE_COPY.heading}
        </h3>
        <p className="mt-1 text-sm text-gray-600">{CLEARANCE_COPY.hint}</p>
      </div>

      {/* Before the list, because it changes how everything below should be read. */}
      {unavailable && (
        <p
          className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-900"
          role="alert"
        >
          {CLEARANCE_COPY.unavailable(unavailable)}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-gray-700">{CLEARANCE_COPY.allClear}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section key={group.kind}>
              <h4 className="text-sm font-medium text-gray-900">
                {CLEARANCE_COPY.groups[group.kind]}
              </h4>
              <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100">
                {group.items.map((item) => (
                  <li
                    key={`${item.kind}:${item.ref}`}
                    className="flex flex-wrap items-start justify-between gap-2 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{item.label}</p>
                      {item.detail && (
                        <p className="mt-0.5 break-words text-xs text-gray-600">
                          {item.detail}
                        </p>
                      )}
                      {item.waiver ? (
                        <>
                          <p className="mt-1 text-xs text-gray-700">
                            {CLEARANCE_COPY.waivedBy(
                              item.waiver.waivedByName,
                              dateTimeLabel(item.waiver.waivedAt),
                            )}
                          </p>
                          <p className="mt-0.5 break-words text-xs italic text-gray-600">
                            {item.waiver.reason}
                          </p>
                          {/* The countersignature, named separately (T090's two facts). A waiver
                              applied before this existed has none, and says nothing rather than
                              claiming an approver it never had. */}
                          {item.waiver.approvedByName &&
                            item.waiver.approvedAt && (
                              <p className="mt-0.5 text-xs text-gray-700">
                                {CLEARANCE_COPY.waiverApprovedBy(
                                  item.waiver.approvedByName,
                                  dateTimeLabel(item.waiver.approvedAt),
                                )}
                              </p>
                            )}
                          {/* Said explicitly, because "waived" reads as "dealt with" and
                              the obligation is still open in its own module. */}
                          <p className="mt-0.5 text-xs text-amber-800">
                            {CLEARANCE_COPY.waivedNotReturned}
                          </p>
                        </>
                      ) : item.proposal?.status === 'pending' ? (
                        /*
                          T050. The pending state, and it must not read as cleared: the obligation is
                          still outstanding and still blocks the settlement. Amber rather than green
                          for that reason — a reader scanning this list for what is done should not
                          find this row among it.
                        */
                        <>
                          <p className="mt-1 text-xs text-amber-900">
                            {CLEARANCE_COPY.waiverPending(
                              item.proposal.proposedByName,
                              dateTimeLabel(item.proposal.proposedAt),
                            )}
                          </p>
                          <p className="mt-0.5 break-words text-xs italic text-gray-600">
                            {item.proposal.reason}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-700">
                            {CLEARANCE_COPY.waiverPendingStill}
                          </p>
                        </>
                      ) : item.proposal?.status === 'rejected' ? (
                        /* T051. Silence after a rejection reads as success. */
                        <>
                          <p className="mt-1 text-xs text-red-800">
                            {CLEARANCE_COPY.waiverRejected(
                              item.proposal.proposedByName,
                              dateTimeLabel(item.proposal.proposedAt),
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-700">
                            {CLEARANCE_COPY.waiverRejectedStill}
                          </p>
                        </>
                      ) : (
                        group.kind === 'asset_custody' && (
                          <p className="mt-1 text-xs text-gray-500">
                            {CLEARANCE_COPY.returnElsewhere}
                          </p>
                        )
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {item.kind === 'asset_custody' && (
                        // Links out; never returns. FR-012b.
                        <Link
                          href={ROUTES.assetsAllocations}
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                        >
                          {CLEARANCE_COPY.openAllocation}
                        </Link>
                      )}
                      {mayPropose &&
                        !item.waiver &&
                        item.proposal?.status !== 'pending' && (
                        <RowAction
                          type="button"
                          onClick={() => {
                            setWaiving(item);
                            setReason('');
                            setError(null);
                          }}
                        >
                            {CLEARANCE_COPY.waive}
                          </RowAction>
                        )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Said once, where somebody would otherwise look for a figure. */}
      {groups.some((group) => group.kind === 'asset_custody') && (
        <p className="text-xs text-gray-500">
          {CLEARANCE_COPY.noAssetValuation}
        </p>
      )}

      {/*
        FR-013: settlement is unavailable while items are outstanding, and the list above IS
        the naming the requirement asks for — "cannot settle yet" with nothing named is an
        instruction nobody can act on. `settleable` comes from the server; see the file
        docblock for why it is not recomputed here.
      */}
      <p
        className={
          data.settleable
            ? 'rounded-md border border-green-200 bg-green-50/60 px-3 py-2 text-sm text-green-900'
            : 'rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800'
        }
        role="status"
      >
        {data.settleable
          ? CLEARANCE_COPY.settleReady
          : /*
              T053. The gate is the api's, but an exit that will not settle with no stated reason
              sends somebody to a developer — and "something is outstanding" is not an answer when
              the thing outstanding is a request already made and sitting on somebody's desk.
            */
            data.items.some(
                (item) =>
                  !item.waiver && item.proposal?.status === 'pending',
              )
            ? CLEARANCE_COPY.settleBlockedPending
            : CLEARANCE_COPY.settleBlocked}
      </p>

      {waiving && (
        <Modal
          title={CLEARANCE_COPY.waiveHeading}
          onClose={() => setWaiving(null)}
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-700">{waiving.label}</p>
            {/* Before the field, not after the button. Somebody who reads this only on success has
                already pressed a control they believed cleared the obligation. */}
            <p className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
              {CLEARANCE_COPY.waiveNeedsApproval}
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">
                {CLEARANCE_COPY.waiveReasonLabel}
              </span>
              <textarea
                value={reason}
                rows={3}
                onChange={(event) => setReason(event.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            {reasonTooShort && (
              <p className="text-xs text-gray-600">
                {CLEARANCE_COPY.waiveReasonShort(WAIVER_REASON_MIN_LENGTH)}
              </p>
            )}
            <FormError message={error} />
            <div className="flex flex-wrap justify-end gap-2">
              <SecondaryButton type="button" onClick={() => setWaiving(null)}>
                {CLEARANCE_COPY.cancel}
              </SecondaryButton>
              <Button
                type="button"
                // Refused here as well as by the server, so the reader learns before
                // submitting rather than from a 400.
                disabled={reasonTooShort || waive.isPending}
                onClick={() => waive.mutate(waiving)}
              >
                {CLEARANCE_COPY.waiveSubmit}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
