import clsx from 'clsx';

/**
 * The app's loading indicator (2026-10-15). The client: "Do we have a spinner or loader in the
 * application, can we introduce it?" Until now a wait said "Loading…" in grey text and nothing
 * moved, which on a slow connection reads as a page that has stopped.
 *
 * A ring in the current text colour, so it suits a navy button and a grey caption alike. Hidden
 * from screen readers: the words beside it ("Loading…", "Saving…") are what is announced.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={clsx('h-4 w-4 shrink-0 animate-spin', className)}
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-20"
      />
      <path
        d="M21.5 12a9.5 9.5 0 0 0-9.5-9.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** "Loading…" with the spinner beside it — what a screen waiting on its data shows. */
export function LoadingText({
  children = 'Loading…',
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <Spinner className="text-brand-500" />
      {children}
    </span>
  );
}
