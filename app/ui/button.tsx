'use client';

import clsx from 'clsx';

import { useCanWrite } from '@/app/lib/write-access';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /**
   * `read` for the rare primary button that changes nothing — a report's "Run", a download.
   * Everything else is a write, which is why that is the default.
   */
  intent?: 'write' | 'read';
}

/**
 * The primary action button — and, since 019 FR-009, **absent for a reader**.
 *
 * Of the 147 places this is used, one changes nothing. So the default hides, and the single
 * exception says `intent="read"`. The alternative was wrapping 146 call sites in a gate and
 * getting one of them wrong without ever finding out: a control left visible to somebody who may
 * not use it produces a 403 somebody has to explain, and nothing in a test suite notices.
 *
 * Which permission "write" means is resolved from the route, not passed in — see
 * `app/lib/write-access.tsx`. Routes outside every module (sign-in, the approvals queue, My
 * Workspace) are ungated, so this is inert there.
 *
 * Removed rather than disabled, per FR-007.
 */
export function Button({
  children,
  className,
  intent = 'write',
  ...rest
}: ButtonProps) {
  const canWrite = useCanWrite();
  if (intent === 'write' && !canWrite) return null;
  return (
    <button
      {...rest}
      className={clsx(
        // Base is the brand navy itself, and hover goes *lighter* rather than the
        // usual darker: at #002d4e the shades below it are nearly black, so darkening
        // gives no visible feedback. Active still darkens, so a press reads.
        // `h-11` below `sm` is 44px — Principle VI's mobile-critical touch target — falling back to
        // the design's `h-10` from `sm` up, where a pointer is doing the aiming. Applied here rather
        // than on the screens that need it: the two mobile-critical surfaces are a closed list today
        // and the next addition to it should not have to remember this.
        // `whitespace-nowrap` because the height above is fixed: a label that wraps to two
        // lines inside an `h-10` box does not grow it, it spills out of it. "Record the payment"
        // in a one-fifth-width grid cell did exactly that.
        'flex h-11 items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-4 text-sm font-medium text-white sm:h-10 sm:justify-start transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:bg-blue-700 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600',
        className,
      )}
    >
      {children}
    </button>
  );
}
