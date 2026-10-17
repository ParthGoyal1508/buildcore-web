'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useId, useRef } from 'react';

import { useLayer, useScrollLock } from '@/app/lib/layers';
import { confirmDialog } from '@/app/ui/dialogs';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog shell for every Settings add/edit form.
 *
 * Focus is moved in on open, trapped while open, and returned to whatever opened it
 * on close; Escape closes. Built on native `<button>`/`<label>` elements throughout
 * rather than div-with-handler, so the whole thing is keyboard-operable and
 * screen-reader-navigable by default (spec FR-024, research.md §8).
 *
 * 036 A8–A10:
 * - Escape goes through the layer stack (`app/lib/layers.ts`), so a confirmation, picker or calendar
 *   open inside this modal is closed first, and the modal only when it is the top layer.
 * - `isDirty` asks "Discard changes?" before Escape, the X or a backdrop click throws typing away;
 *   `pending` ignores all three while a save is on the wire — closing then left the request running
 *   with nothing on screen to say whether it landed.
 * - The title id comes from `useId()` (two stacked modals used to share one), the page behind stops
 *   scrolling, and the height is in `dvh` so the footer is not hidden under the iOS toolbar.
 */
export default function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
  isDirty = false,
  pending = false,
  closeOnBackdrop = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  /** Asks before closing by Escape, the X or the backdrop. Pass react-hook-form's `isDirty`. */
  isDirty?: boolean;
  /** While true, Escape, the X and the backdrop do nothing. Pass the mutation's `isPending`. */
  pending?: boolean;
  /** A click on the dimmed page closes (through the same dirty check). Off by default. */
  closeOnBackdrop?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const asking = useRef(false);

  const requestClose = useCallback(async () => {
    if (pending || asking.current) return;
    if (isDirty) {
      asking.current = true;
      const discard = await confirmDialog({
        title: 'Discard changes?',
        message: 'What you have entered in this form will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        tone: 'danger',
      });
      asking.current = false;
      if (!discard) return;
    }
    onClose();
  }, [isDirty, onClose, pending]);

  const isTop = useLayer(() => void requestClose());
  useScrollLock();

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    // Restore focus to the trigger, so closing doesn't dump the user at the top of
    // the document.
    return () => previouslyFocused.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Escape is the layer stack's (above). Tab is trapped only while this is the top layer: a
      // confirmation open above it keeps its own trap.
      if (event.key !== 'Tab' || !isTop()) return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Wrap at both ends, so Tab can never escape the dialog into the page behind.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isTop]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          void requestClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={pending || undefined}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-lg bg-white shadow-xl sm:rounded-lg ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 id={titleId} className="text-lg font-medium">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => void requestClose()}
            disabled={pending}
            aria-label="Close"
            // 44×44px below `sm` (016 FR-021). `p-1` around a 20px icon is a 28px target: reachable
            // with a mouse, missed with a thumb — and the close control being the one somebody stabs
            // at repeatedly makes it the worst one to leave small.
            className="flex min-h-11 min-w-11 items-center justify-center rounded text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:min-w-0 sm:p-1"
          >
            <XMarkIcon className="w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div
            // Stacked and full-width below `sm`, side by side above it. On a 320px sheet two buttons
            // sharing a row leaves each about 130px wide with its label wrapping, and the primary
            // action is the one on the right — furthest from a right thumb's natural arc. Reversed
            // column order puts it at the bottom, where the thumb already is, without reordering the
            // DOM and so without changing tab order.
            className="flex flex-col-reverse gap-2 border-t bg-gray-50 px-5 py-3 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto"
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
