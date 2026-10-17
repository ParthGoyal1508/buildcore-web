'use client';

import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * Brief confirmation that something happened — "Vendor saved", "Couldn't delete the item" (036 A17).
 *
 * There was no shared way to say it. Some screens put up a banner of their own, most said nothing,
 * and after a modal closed on Save the only evidence the save landed was the row changing somewhere
 * in a list. No dependency: a list in a module, the same store-and-host shape as `dialogs.tsx`.
 *
 *     const toast = useToast();
 *     onSuccess: () => toast.success('Vendor saved'),
 *     onError: (err) => toast.error(errorMessage(err)),
 *
 * `toast` itself is exported too, for code outside a component (a shared mutation helper).
 *
 * Announced through a live region — politely for success and info, assertively for an error — so a
 * screen-reader user hears the outcome without focus moving. Success and info leave after 4 s, an
 * error after 8 s, and any can be dismissed sooner.
 */

export type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

const DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  error: 8000,
};
/** More than this on screen at once is noise; the oldest goes. */
const MAX_VISIBLE = 4;

let nextId = 1;
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => toasts;
const EMPTY: Toast[] = [];

function show(tone: ToastTone, message: string): number {
  const id = nextId++;
  toasts = [...toasts, { id, tone, message }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export const toast = {
  success: (message: string) => show('success', message),
  error: (message: string) => show('error', message),
  info: (message: string) => show('info', message),
  dismiss: dismissToast,
};

/** The same functions as `toast`, for symmetry with the other hooks a component uses. */
export function useToast() {
  return toast;
}

/** Mounted once, in the root layout. */
export function ToastHost() {
  const list = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const polite = list.filter((item) => item.tone !== 'error');
  const urgent = list.filter((item) => item.tone === 'error');

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1200] flex flex-col items-center gap-2 p-4 sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:items-end">
      {/* Two regions so an error interrupts and a success waits its turn. Both always rendered: a
          live region added at the same moment as its text is often not announced at all. */}
      <div aria-live="polite" className="flex flex-col items-center gap-2 sm:items-end">
        {polite.map((item) => (
          <ToastCard key={item.id} toast={item} />
        ))}
      </div>
      <div aria-live="assertive" className="flex flex-col items-center gap-2 sm:items-end">
        {urgent.map((item) => (
          <ToastCard key={item.id} toast={item} />
        ))}
      </div>
    </div>
  );
}

function ToastCard({ toast: item }: { toast: Toast }) {
  useEffect(() => {
    const timer = window.setTimeout(
      () => dismissToast(item.id),
      DURATION[item.tone],
    );
    return () => window.clearTimeout(timer);
  }, [item.id, item.tone]);

  const Icon =
    item.tone === 'success'
      ? CheckCircleIcon
      : item.tone === 'error'
        ? ExclamationCircleIcon
        : InformationCircleIcon;

  return (
    <div
      role={item.tone === 'error' ? 'alert' : 'status'}
      className={clsx(
        'pointer-events-auto flex w-full max-w-sm animate-pop-down items-start gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg',
        item.tone === 'success' && 'border-green-200',
        item.tone === 'error' && 'border-red-200',
        item.tone === 'info' && 'border-gray-200',
      )}
    >
      <Icon
        aria-hidden="true"
        className={clsx(
          'mt-0.5 h-5 w-5 shrink-0',
          item.tone === 'success' && 'text-green-600',
          item.tone === 'error' && 'text-red-600',
          item.tone === 'info' && 'text-brand-600',
        )}
      />
      <p className="min-w-0 flex-1 text-gray-800">{item.message}</p>
      <button
        type="button"
        onClick={() => dismissToast(item.id)}
        aria-label="Dismiss"
        className="-m-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-500"
      >
        <XMarkIcon aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
