'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog shell for every Settings add/edit form.
 *
 * Focus is moved in on open, trapped while open, and returned to whatever opened it
 * on close; Escape closes. Built on native `<button>`/`<label>` elements throughout
 * rather than div-with-handler, so the whole thing is keyboard-operable and
 * screen-reader-navigable by default (spec FR-024, research.md §8).
 */
export default function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

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
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

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
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-lg bg-white shadow-xl sm:rounded-lg ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 id="settings-modal-title" className="text-lg font-medium">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <XMarkIcon className="w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t bg-gray-50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
