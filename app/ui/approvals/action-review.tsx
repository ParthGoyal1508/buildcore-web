'use client';

import clsx from 'clsx';
import { useState } from 'react';

import type {
  ApprovalDecisionAction,
  ApprovalInertReason,
  ApprovalState,
} from '@/app/lib/api/approvals';
import {
  APPROVAL_ACTIONS,
  APPROVAL_INERT_MESSAGES,
  APPROVAL_RESUBMIT,
} from '@/app/lib/constants';
import { RowAction } from '@/app/ui/settings/form-fields';

/**
 * The one Action/Review control, used identically everywhere (spec FR-001, FR-002).
 *
 * **Sameness is the feature.** A reviewer learns this control once and then knows it in
 * every module. That is why the props below are so short, and why the ones that are
 * missing are missing on purpose:
 *
 * - **No module identity.** Nothing here may behave differently because it is rendering
 *   an indent rather than a payroll run. A module prop is the single thing that would let
 *   one module diverge, and divergence is the failure this component exists to prevent.
 * - **No role names, no permission values.** Authority resolves through configurable role
 *   slots, so the two companies may staff the same level differently. Every word about
 *   who decides comes from the server's `levelLabel` and `awaitingUserName` (FR-003b).
 * - **No copy.** Every sentence is in `app/lib/constants.ts` (Principle III), so the same
 *   decision reads the same way wherever it appears.
 *
 * A module that cannot express its needs through this interface must have the interface
 * extended — not fork the component (research.md §1).
 */

/**
 * Exactly what this control reads, and nothing more.
 *
 * A structural subset rather than the full `ApprovalState`, so that a caller holding only
 * part of one — the queue row, which carries what a queue needs and not what a record
 * needs — can satisfy it **without fabricating the rest**. The first version of the queue
 * did fabricate it: `totalLevels`, `round` and `returnCount` invented to fill the shape.
 * Every one of those was a number the browser did not know, presented as if it did, and
 * the day this component started reading one of them the queue would have lied quietly.
 *
 * `ApprovalState` satisfies this structurally, so a module passes its state unchanged.
 */
export interface ActionReviewState {
  instanceId: string;
  canActNow: boolean;
  inertReason: ApprovalInertReason | null;
  /** The level deciding now. Null once the chain has finished. */
  levelLabel: string | null;
  /** Named only when exactly one person could act. */
  awaitingUserName: string | null;
  /** Both optional: a queue row knows its position but not the chain's length. */
  currentPosition?: number;
  totalLevels?: number;
  /**
   * True only for the originator of a returned item. Optional so a caller holding an
   * older shape still satisfies this interface; absent means no.
   */
  canResubmitNow?: boolean;
}

export interface ActionReviewProps {
  /** The item's approval state, from its own module's endpoint. */
  state: ActionReviewState;
  /**
   * Records the decision. Throws on refusal — and **must** throw rather than swallow:
   * this component keeps the typed reason and shows the error, and it can only do that
   * if it learns the call failed.
   */
  onDecide: (
    action: ApprovalDecisionAction,
    reason?: string,
  ) => Promise<unknown>;
  /**
   * Sends a returned item back up its chain. Throws on refusal, like `onDecide`.
   *
   * Optional: a module that has not wired resubmission yet simply does not pass it, and
   * the originator is told the item was returned without being offered a button that
   * cannot work. Omitting it is a smaller failure than a button that throws.
   */
  onResubmit?: () => Promise<unknown>;
  /** "this attendance correction" — used in the confirmation prompt. */
  entityLabel: string;
  /** `inline` for a table cell, `full` for a detail view. Layout only. */
  size?: 'inline' | 'full';
}

export default function ActionReview({
  state,
  onDecide,
  onResubmit,
  entityLabel,
  size = 'full',
}: ActionReviewProps) {
  /** Which action is being composed, when one needs a reason before it can be sent. */
  const [pending, setPending] = useState<ApprovalDecisionAction | null>(null);
  /**
   * The typed reason, held here and **deliberately not cleared on failure** (FR-006).
   *
   * Losing a paragraph of justification to a dropped connection is how people stop
   * trusting a system — and the next thing they type is shorter.
   */
  const [reason, setReason] = useState('');
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inline = size === 'inline';

  // ── Inert states (FR-003, FR-003a) ─────────────────────────────────────────
  //
  // Branching on `inertReason`, never on message text — the contract feature 015
  // established with `SESSION_EXPIRED`. The four states are four different sentences
  // because they have four different remedies.
  if (!state.canActNow) {
    // ── Returned, and this reader is the one who raised it (FR-005) ──────────
    //
    // Checked before the inert branch below, because a returned item has no
    // `inertReason` — nobody is being asked to decide — and would otherwise fall through
    // to `return null` and vanish from the screen of the only person who can move it.
    if (state.canResubmitNow && onResubmit) {
      return (
        <div className={clsx('space-y-2', inline ? 'min-w-[16rem]' : 'max-w-xl')}>
          <p className="text-xs text-gray-700">{APPROVAL_RESUBMIT.prompt}</p>
          <p className="text-xs text-gray-500">{APPROVAL_RESUBMIT.hint}</p>
          {error && (
            <p role="alert" className="text-xs text-red-700">
              {error}
            </p>
          )}
          <RowAction
            onClick={() => {
              setError(null);
              setInFlight(true);
              onResubmit()
                .catch((e: unknown) =>
                  setError(
                    e instanceof Error
                      ? e.message
                      : APPROVAL_RESUBMIT.failed,
                  ),
                )
                .finally(() => setInFlight(false));
            }}
            disabled={inFlight}
          >
            {inFlight ? APPROVAL_RESUBMIT.inFlight : APPROVAL_RESUBMIT.action}
          </RowAction>
        </div>
      );
    }

    if (!state.inertReason) {
      // The chain has finished, or nobody in particular is being addressed. Saying
      // nothing is correct: there is no action, and inventing a refusal message would
      // explain a refusal nobody received.
      return null;
    }

    const message = APPROVAL_INERT_MESSAGES[state.inertReason](
      state.awaitingUserName,
      state.levelLabel,
    );
    // `slot_unmapped` is the only one describing a fault rather than a state, and it
    // reads that way — amber, not grey, because waiting will not fix it.
    const isFault = state.inertReason === 'slot_unmapped';

    return (
      <p
        // A fault is announced; the other three are ordinary status a reader reaches
        // when they get to it.
        role={isFault ? 'status' : undefined}
        className={clsx(
          'rounded-md px-2.5 py-1.5 text-xs',
          inline ? 'inline-block' : 'block',
          isFault
            ? 'bg-amber-50 text-amber-900'
            : 'bg-gray-50 text-gray-600',
        )}
      >
        {message}
      </p>
    );
  }

  // ── Actionable ─────────────────────────────────────────────────────────────

  const submit = async (action: ApprovalDecisionAction, text?: string) => {
    setError(null);
    setInFlight(true);
    try {
      await onDecide(action, text);
      // Cleared only on success. Anything else keeps what was typed.
      setReason('');
      setPending(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'The decision could not be recorded. Please try again.',
      );
      // Deliberately no navigation and no sign-out. Only a 401 from renewal ends a
      // session (feature 015); losing a screen mid-review is exactly the regression
      // worth guarding against.
    } finally {
      setInFlight(false);
    }
  };

  const start = (action: ApprovalDecisionAction) => {
    const config = APPROVAL_ACTIONS.find((a) => a.action === action);
    if (config?.requiresReason) {
      // Asked for inline, before sending. The server refuses a reject or return with no
      // reason; asking first means nobody is told off for something the form could have
      // requested.
      setPending(action);
      setError(null);
      return;
    }
    void submit(action);
  };

  if (pending) {
    const config = APPROVAL_ACTIONS.find((a) => a.action === pending);
    const ready = reason.trim().length > 0;

    return (
      <div className={clsx('space-y-2', inline ? 'min-w-[16rem]' : 'max-w-xl')}>
        <label
          htmlFor={`approval-reason-${state.instanceId}`}
          className="block text-xs font-medium text-gray-700"
        >
          Why are you choosing to {config?.label.toLowerCase()} {entityLabel}?
        </label>
        <textarea
          id={`approval-reason-${state.instanceId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          disabled={inFlight}
          className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:bg-gray-50"
          placeholder="This is recorded against the item and shown to everyone who approved earlier."
        />
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <RowAction
            type="button"
            // Disabled while in flight so repeated clicks produce exactly one request
            // (FR-005), and disabled without a reason so the request is never sent to
            // be refused (FR-004).
            disabled={inFlight || !ready}
            onClick={() => void submit(pending, reason.trim())}
            className="border-gray-300 bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-400"
          >
            {inFlight ? 'Recording…' : `Confirm ${config?.label.toLowerCase()}`}
          </RowAction>
          <RowAction
            type="button"
            disabled={inFlight}
            onClick={() => {
              setPending(null);
              setError(null);
              // The text is kept, not cleared: someone who backs out of a rejection to
              // re-read the item should not have to retype their reasoning.
            }}
          >
            Cancel
          </RowAction>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(inline ? 'flex flex-wrap gap-1.5' : 'space-y-2')}>
      <div className="flex flex-wrap gap-2">
        {APPROVAL_ACTIONS.map(({ action, label }) => (
          <RowAction
            key={action}
            type="button"
            disabled={inFlight}
            onClick={() => start(action)}
            className={
              action === 'approve'
                ? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
                : undefined
            }
          >
            {inFlight && action === 'approve' ? 'Recording…' : label}
          </RowAction>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      {state.levelLabel && !inline && (
        <p className="text-xs text-gray-500">
          You are deciding at {state.levelLabel}
          {/* Only when the caller actually supplied both. A queue row knows its position
              and not the chain's length, and "level 2 of 2" would be a guess. */}
          {state.totalLevels && state.currentPosition && state.totalLevels > 1
            ? ` — level ${state.currentPosition} of ${state.totalLevels}`
            : ''}
          .
        </p>
      )}
    </div>
  );
}

/** Re-exported so a module importing the control does not reach past it for the type. */
export type { ApprovalState };
