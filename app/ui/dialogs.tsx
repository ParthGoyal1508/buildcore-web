'use client';

import {
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

import { useLayer } from '@/app/lib/layers';
import { Button, DangerButton, SecondaryButton } from '@/app/ui/button';

/**
 * The app's own confirm and prompt (2026-10-15), in place of `window.confirm` and `window.prompt`.
 *
 * The client: "We want to remove these types of alerts, instead create the modals." The browser's
 * boxes are drawn by the browser — "localhost:3001 says", its own colours, a dark sheet on one
 * machine and a grey one on the next — and nothing about them can be styled or worded.
 *
 * Called the way the browser's were, so a call site changes by one word and an `await`:
 *
 *     if (await confirmDialog(MESSAGES.discardChanges)) router.back();
 *     const reason = await promptDialog({ message: 'Why is this being rejected?', required: true });
 *
 * One dialog at a time, rendered by `DialogHost` (mounted once in the root layout). A second call
 * while one is open waits its turn rather than replacing it.
 */

type Tone = 'danger' | 'default';

interface ConfirmOptions {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red for something that cannot be undone. Guessed from the wording when not given. */
  tone?: Tone;
  /**
   * A word the reader must type before the action is allowed — `'DELETE'` — for the deletes that
   * take a great deal with them (a project, a site, a client). The client, 2026-10-15: "if by
   * mistake someone clicks on project delete then it will be a problem". One stray click, or an
   * Enter meant for something else, can no longer get past it.
   */
  typeToConfirm?: string;
}

interface PromptOptions extends ConfirmOptions {
  /** The field's label, when the message alone does not name what is asked for. */
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  /** OK stays disabled until something other than spaces is typed. */
  required?: boolean;
  /** A text area, for a reason or remarks; a single line otherwise. */
  multiline?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}

type Request = { id: number } & (
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | {
      kind: 'prompt';
      options: PromptOptions;
      resolve: (value: string | null) => void;
    }
);

let nextId = 1;

let queue: Request[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const current = () => queue[0] ?? null;

function enqueue(request: Request) {
  queue = [...queue, request];
  emit();
}
function settle() {
  queue = queue.slice(1);
  emit();
}

const DANGER =
  /\b(delete|remove|discard|reverse|reject|close|abandon|cancel|withdraw|void|revoke|deactivate)\b/i;

const asOptions = <T extends ConfirmOptions>(input: string | T) =>
  (typeof input === 'string' ? { message: input } : input) as T;

/** `window.confirm`, as a modal: resolves `true` for OK, `false` for Cancel or Escape. */
export function confirmDialog(
  input: string | ConfirmOptions,
): Promise<boolean> {
  return new Promise((resolve) =>
    enqueue({
      id: nextId++,
      kind: 'confirm',
      options: asOptions(input),
      resolve,
    }),
  );
}

/** `window.prompt`, as a modal: the text typed, or `null` for Cancel or Escape. */
export function promptDialog(
  input: string | PromptOptions,
): Promise<string | null> {
  return new Promise((resolve) =>
    enqueue({
      id: nextId++,
      kind: 'prompt',
      options: asOptions(input),
      resolve,
    }),
  );
}

export function DialogHost() {
  const request = useSyncExternalStore(subscribe, current, () => null);
  if (!request) return null;
  // Keyed by the request, so the next one in the queue opens with a fresh field.
  return createPortal(
    <Dialog key={request.id} request={request} />,
    document.body,
  );
}

function Dialog({ request }: { request: Request }) {
  const { options } = request;
  const prompt =
    request.kind === 'prompt' ? (request.options as PromptOptions) : null;
  const [value, setValue] = useState(prompt?.defaultValue ?? '');
  const titleId = useId();
  const messageId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const restoreFocus = useRef<Element | null>(null);

  const text = typeof options.message === 'string' ? options.message : '';
  const tone: Tone =
    options.tone ??
    (DANGER.test(`${options.title ?? ''} ${text}`) ? 'danger' : 'default');
  const mustType =
    request.kind === 'confirm' ? options.typeToConfirm : undefined;
  const blocked = Boolean(
    (prompt?.required && !value.trim()) ||
    (mustType && value.trim() !== mustType),
  );

  const close = (ok: boolean) => {
    if (request.kind === 'confirm') request.resolve(ok);
    else request.resolve(ok ? value : null);
    settle();
    (restoreFocus.current as HTMLElement | null)?.focus?.();
  };

  // A layer of its own (036 A8), so Escape here never reaches a modal underneath — whether or not
  // focus is inside this dialog when it is pressed.
  useLayer(() => close(false));

  useEffect(() => {
    restoreFocus.current = document.activeElement;
    (fieldRef.current ?? confirmRef.current)?.focus();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(false);
    } else if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !(prompt?.multiline && event.target === fieldRef.current) &&
      !blocked
    ) {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      // Keep Tab inside the dialog: the page behind it is not the reader's to reach right now.
      const focusable = Array.from(
        (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, textarea',
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  const Icon =
    tone === 'danger' ? ExclamationTriangleIcon : QuestionMarkCircleIcon;
  const title =
    options.title ??
    (prompt
      ? (prompt.label ?? 'A little more detail')
      : tone === 'danger'
        ? 'Are you sure?'
        : 'Please confirm');
  const field =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30';

  const confirmLabel =
    options.confirmLabel ??
    (prompt ? 'Continue' : tone === 'danger' ? 'Yes, continue' : 'OK');

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-end justify-center p-4 sm:items-center"
      onKeyDown={onKeyDown}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-brand-950/40 backdrop-blur-[2px]"
        onMouseDown={() => close(false)}
      />
      <div
        role={tone === 'danger' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative w-full max-w-md animate-pop-down overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex gap-4 p-5 sm:p-6">
          <span
            aria-hidden="true"
            className={clsx(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              tone === 'danger'
                ? 'bg-red-50 text-red-600'
                : 'bg-brand-50 text-brand-600',
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-gray-900">
              {title}
            </h2>
            <div
              id={messageId}
              className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-600"
            >
              {options.message}
            </div>
            {mustType && (
              <label className="mt-4 block text-sm text-gray-700">
                Type{' '}
                <span className="font-mono font-semibold text-red-700">
                  {mustType}
                </span>{' '}
                to confirm
                <input
                  ref={fieldRef}
                  value={value}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setValue(event.target.value)}
                  className={clsx(field, 'mt-1.5 font-mono tracking-wider')}
                />
              </label>
            )}
            {prompt &&
              (prompt.multiline ? (
                <textarea
                  ref={fieldRef}
                  rows={3}
                  value={value}
                  placeholder={prompt.placeholder}
                  aria-label={prompt.label ?? title}
                  onChange={(event) => setValue(event.target.value)}
                  className={clsx(field, 'mt-3')}
                />
              ) : (
                <input
                  ref={fieldRef}
                  value={value}
                  inputMode={prompt.inputMode}
                  placeholder={prompt.placeholder}
                  aria-label={prompt.label ?? title}
                  onChange={(event) => setValue(event.target.value)}
                  className={clsx(field, 'mt-3')}
                />
              ))}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
          <SecondaryButton
            type="button"
            onClick={() => close(false)}
          >
            {options.cancelLabel ?? 'Cancel'}
          </SecondaryButton>
          {/* The danger confirm is the primary's shape in red; both are `DangerButton`/`Button`
              rather than hand-built since 036 A21. `intent="read"`: a dialog is only ever opened
              by an action that was already gated. */}
          {tone === 'danger' ? (
            <DangerButton
              ref={confirmRef}
              disabled={blocked}
              onClick={() => close(true)}
            >
              {confirmLabel}
            </DangerButton>
          ) : (
            <Button
              ref={confirmRef}
              type="button"
              intent="read"
              disabled={blocked}
              onClick={() => close(true)}
            >
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
