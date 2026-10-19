'use client';

import clsx from 'clsx';
import Link from 'next/link';

import { useCanWrite } from '@/app/lib/write-access';
import {
  ActionGlyph,
  labelText,
  type Icon as ActionIcon,
} from '@/app/ui/action-icons';
import { FileGlyph } from '@/app/ui/file-icons';
import { Spinner } from '@/app/ui/spinner';

/**
 * Every button in the app, in one file (036 A21).
 *
 * There were 128 hand-rolled `<button>`s beside the primary `Button` and the two in
 * `settings/form-fields.tsx`, with six different focus rings between them (brand, accent, red,
 * amber, none at all) and as many ways of saying "disabled". The variants below are the whole set:
 *
 * | Variant           | For                                                              |
 * |-------------------|------------------------------------------------------------------|
 * | `Button`          | the one primary action of a screen or form — **gated on write**   |
 * | `SecondaryButton` | Cancel, Back, Download, a pager's Previous/Next                   |
 * | `DangerButton`    | the confirming click of something that cannot be undone           |
 * | `TextButton`      | a link-looking action inside prose or a row: "Show every line"    |
 * | `IconButton`      | a glyph alone — close, remove, previous/next — and a *required* label |
 * | `RowAction`       | the small bordered action in a list row — **gated on write**      |
 *
 * All of them share `FOCUS_RING` and take `loading` (disabled, a spinner, `aria-busy` — 036 A7).
 * `DangerButton`, `TextButton` and `IconButton` are `type="button"` unless told otherwise — a bare
 * `<button>` inside a form submits it, and none of those is ever a form's submit. `Button`,
 * `SecondaryButton` and `RowAction` keep the native default, because ~150 forms already rely on
 * `<Button>` submitting them.
 *
 * Genuinely custom controls — tabs, menu items, calendar days, combobox options — stay hand-built
 * (the lint rule's allow-list names their files), but take `FOCUS_RING` so the keyboard sees one
 * app rather than a dozen.
 */

/**
 * The one keyboard focus treatment (2026-10-14 accent pass, made shared by 036 A21). The accent
 * rather than the navy: a navy ring around a navy button, or on the navy header, was all but
 * invisible.
 */
export const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';

type Size = 'md' | 'sm';

/**
 * - **`md`** is `h-11` below `sm` — 44px, Principle VI's mobile-critical touch target — and the
 *   design's `h-10` from `sm` up, where a pointer is doing the aiming. Applied here rather than on
 *   the screens that need it, so the next mobile-critical surface does not have to remember.
 * - **`sm`** is for toolbars and pagers inside a card, where a 40px button towers over the text.
 *
 * `whitespace-nowrap` because the height is fixed: a label that wraps to two lines inside an
 * `h-10` box does not grow it, it spills out of it ("Record the payment" in a one-fifth-width grid
 * cell did exactly that).
 */
const SIZE: Record<Size, string> = {
  md: 'flex h-11 px-4 sm:h-10 sm:justify-start',
  sm: 'inline-flex h-9 px-3',
};

const BASE = clsx(
  'items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors',
  FOCUS_RING,
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 disabled:cursor-not-allowed disabled:opacity-50',
);

/**
 * - **primary**: the brand navy itself, and hover goes *lighter* rather than the usual darker — at
 *   #002d4e the shades below it are nearly black, so darkening gives no visible feedback. Active
 *   still darkens, so a press reads. `shadow-sm` lifts it off the tinted page ground.
 * - **secondary**: white with a border that picks up the brand on hover, so it reads as a control
 *   rather than a box.
 * - **danger**: the primary's shape in red — rose-600, white on it is 4.7:1.
 */
const VARIANT = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-500 active:bg-brand-700 disabled:hover:bg-brand-600',
  secondary:
    'border border-gray-300 bg-white text-gray-700 shadow-sm hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-500 active:bg-red-700 disabled:hover:bg-red-600',
} as const;

// `ComponentProps<'button'>` rather than the attribute type so `ref` passes through — React 19
// hands a function component its `ref` as a plain prop, and dialogs focus their close button by it.
type BaseProps = React.ComponentProps<'button'> & {
  /**
   * The action this button starts is in flight (036 A7): disabled, a spinner, `aria-busy`. Pass the
   * mutation's `isPending`. A second click on a Save that has not answered yet used to send a second
   * request — 33 money and approval actions had no lock at all.
   */
  loading?: boolean;
};

/** A button that says it is working — "Saving…" while disabled — gets the spinner too, so every
 * pending save looks the same without each screen adding one. */
function isBusy(loading: boolean, disabled: boolean | undefined, children: React.ReactNode) {
  return loading || (!!disabled && labelText(children).trim().endsWith('…'));
}

function LabelledButton({
  children,
  className,
  loading = false,
  variant,
  size = 'md',
  ...rest
}: BaseProps & { variant: keyof typeof VARIANT; size?: Size }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || rest['aria-busy'] || undefined}
      className={clsx(BASE, SIZE[size], VARIANT[variant], className)}
    >
      {isBusy(loading, rest.disabled, children) ? (
        <Spinner />
      ) : (
        // "Excel", "PDF", "Word" on a button get their format's mark (2026-10-15).
        <FileGlyph label={labelText(children)} />
      )}
      {children}
    </button>
  );
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
  intent = 'write',
  ...rest
}: BaseProps & {
  children: React.ReactNode;
  /**
   * `read` for the rare primary button that changes nothing — a report's "Run", a download — or
   * that is gated somewhere else already: a dialog's confirm, reached only through a gated action;
   * an error screen's Retry. Everything else is a write, which is why that is the default.
   */
  intent?: 'write' | 'read';
  size?: Size;
}) {
  const canWrite = useCanWrite();
  if (intent === 'write' && !canWrite) return null;
  return <LabelledButton {...rest} variant="primary" />;
}

/**
 * Secondary action button: Cancel, Back, Download, Previous/Next. Not gated — none of these
 * changes anything on its own. 44px below `sm` for the reason `Button` is: a Cancel that is hard to
 * hit is how somebody submits a form they meant to abandon.
 */
export function SecondaryButton(props: BaseProps & { size?: Size }) {
  return <LabelledButton {...props} variant="secondary" />;
}

/**
 * The confirming click of something that cannot be undone — "Yes, mark as scrapped", a dialog's
 * danger confirm. Not gated: it is only ever reached through an action that already was.
 */
export function DangerButton({
  type = 'button',
  ...rest
}: BaseProps & { size?: Size }) {
  return <LabelledButton {...rest} type={type} variant="danger" />;
}

/**
 * An action drawn as a link: "Show every schedule line", "Edit bank details", "Clear filters".
 *
 * `tone="danger"` for Remove and its kin; `tone="inherit"` inside a coloured banner, where the
 * banner's own colour is the right one. `size="xs"` for the small print under a table.
 */
export function TextButton({
  children,
  className,
  loading = false,
  tone = 'brand',
  size = 'sm',
  type = 'button',
  ...rest
}: BaseProps & {
  tone?: 'brand' | 'danger' | 'inherit';
  size?: 'sm' | 'xs';
}) {
  return (
    <button
      {...rest}
      type={type}
      disabled={rest.disabled || loading}
      aria-busy={loading || rest['aria-busy'] || undefined}
      className={clsx(
        'inline-flex items-center gap-1 rounded font-medium underline-offset-2 transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline',
        FOCUS_RING,
        size === 'xs' ? 'text-xs' : 'text-sm',
        tone === 'brand' && 'text-brand-700 hover:text-brand-900',
        tone === 'danger' && 'text-red-700 hover:text-red-800',
        className,
      )}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

/**
 * A button that is only a glyph: close, remove, previous, next.
 *
 * **`label` is required** (036 A22) and becomes both the accessible name and the tooltip. An icon
 * with no name is announced as "button" and nothing else — the audit found close buttons and "×"
 * removers that said exactly that. Typed as required rather than checked at run time so it cannot
 * ship without one.
 *
 * - `md`: 44×44 below `sm`, 36×36 above — the same touch-target rule as `Button`.
 * - `lg`: 44×44 at every width, for a mobile-critical screen (016 T112: a supervisor on site with
 *   one hand on a phone).
 * - `sm`: 32×32, for a remove inside a chip or a dense row.
 * - `xs`: 24×24, for a toast's dismiss or the remove badge on a photo thumbnail.
 *
 * `tone="overlay"` is the dark round badge that sits on a photo's corner.
 */
const ICON_SIZE = {
  lg: 'h-11 w-11',
  md: 'h-11 w-11 sm:h-9 sm:w-9',
  sm: 'h-8 w-8',
  xs: 'h-6 w-6',
} as const;

const ICON_TONE = {
  neutral: 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
  danger: 'text-gray-500 hover:bg-red-50 hover:text-red-700',
  overlay: 'rounded-full bg-gray-900/90 text-white hover:bg-gray-700',
} as const;

export function IconButton({
  label,
  children,
  className,
  loading = false,
  tone = 'neutral',
  size = 'md',
  type = 'button',
  ...rest
}: Omit<BaseProps, 'aria-label'> & {
  label: string;
  tone?: 'neutral' | 'danger' | 'overlay';
  size?: 'lg' | 'md' | 'sm' | 'xs';
}) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={rest.title ?? label}
      disabled={rest.disabled || loading}
      aria-busy={loading || rest['aria-busy'] || undefined}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        FOCUS_RING,
        ICON_SIZE[size],
        ICON_TONE[tone],
        className,
      )}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

/**
 * Small inline action used in list rows.
 *
 * **Gated on write access by default** (019 FR-009, FR-007). Nearly every row action in this app
 * changes something — Edit, Delete, Approve, Disburse, Reverse — so the default that is right 65
 * times out of 70 is the one that hides. A read-only holder sees the list and no way to act on it,
 * and nothing had to be remembered at each of the 65 call sites for that to be true.
 *
 * `intent="read"` for the handful that only look: Open, Download, View. Spelling it out at those
 * call sites is the trade this makes — and it is the right way round, because forgetting `read`
 * hides a harmless control, while forgetting `write` would leave a destructive one on screen for
 * somebody who may not use it.
 *
 * Removed, not disabled: FR-007 says so, and a disabled button still advertises an action its
 * viewer cannot take, inviting the support call that asks why it does nothing.
 *
 * The server refuses either way. This is the affordance; `PermissionsGuard` is the boundary.
 */
// Row actions carry an icon beside their label since 2026-10-15 (`app/ui/action-icons.tsx`).
const ROW_ACTION = clsx(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40',
  FOCUS_RING,
);

const DESTRUCTIVE = /^(delete|remove|discard)\b/i;

export function RowAction({
  children,
  className,
  intent = 'write',
  icon,
  loading = false,
  ...rest
}: React.ComponentProps<'button'> & {
  intent?: 'write' | 'read';
  /** The icon beside the label; chosen from the label's verb when not given, `null` for none. */
  icon?: ActionIcon | null;
  /** In flight: disabled, a spinner in place of the icon, `aria-busy` (036 A7). */
  loading?: boolean;
}) {
  const canWrite = useCanWrite();
  if (intent === 'write' && !canWrite) return null;
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || rest['aria-busy'] || undefined}
      className={clsx(
        ROW_ACTION,
        // A destructive action warns on hover rather than inviting like the others.
        DESTRUCTIVE.test(labelText(children).trim()) &&
          'hover:border-red-300 hover:bg-red-50 hover:text-red-700',
        className,
      )}
    >
      {loading ? (
        <Spinner className="h-3.5 w-3.5" />
      ) : (
        <ActionGlyph label={children} icon={icon} />
      )}
      {children}
    </button>
  );
}

/** A row action that navigates — Open, Edit — drawn exactly like `RowAction`. */
export function RowActionLink({
  children,
  className,
  icon,
  ...rest
}: React.ComponentProps<typeof Link> & { icon?: ActionIcon | null }) {
  return (
    <Link {...rest} className={clsx(ROW_ACTION, className)}>
      <ActionGlyph label={children} icon={icon} />
      {children}
    </Link>
  );
}
