'use client';

import clsx from 'clsx';
import Link from 'next/link';

import { useCanWrite } from '@/app/lib/write-access';
import {
  ActionGlyph,
  labelText,
  type Icon as ActionIcon,
} from '@/app/ui/action-icons';
import { Spinner } from '@/app/ui/spinner';

/**
 * The box every field shares (2026-10-14 consistency pass).
 *
 * - **`border-gray-300`**, not 200: at 200 an empty input on the new tinted page ground was a
 *   barely-there outline, and a field you cannot see is a field nobody fills in.
 * - **`bg-white`** stated, so a field reads as a field on a tinted panel as well as a white one.
 * - **One focus treatment.** It used to be an offset outline *and* the forms plugin's own ring,
 *   drawn together — two concentric rectangles. Now the border itself turns accent with a
 *   one-pixel ring of the same colour, the convention every other control in the shell follows.
 */
const FIELD_BOX =
  'rounded-md border border-gray-300 bg-white text-sm text-gray-900 shadow-sm transition-colors focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 disabled:bg-gray-50 disabled:text-gray-500';

/** The box a text input, textarea or date field gets. Exported for the handful of
 *  screens that build their own labelled field rather than using `TextField`. */
// `min-h-10`: 40px, the same as `Button` and `SecondaryButton` from `sm` up, so a field and the
// button beside it line up instead of differing by the 2px they used to.
export const fieldClass = `block min-h-10 w-full py-2 px-3 placeholder:text-gray-400 ${FIELD_BOX}`;

/**
 * The box a `<select>` gets, which is deliberately not the one a text input gets.
 *
 * The browser draws the chevron inside the field's own right padding, so a select
 * with the symmetric `px-3` an input uses paints it *over* the tail of the selected
 * option — plainly visible on the Site Dashboard, where "Select a site…" ran into
 * the arrow. `pr-9` reserves the room the arrow was always going to take.
 *
 * Exported because seven selects around the app were hand-rolled rather than built
 * from `SelectField`, and four of them had no width at all: a bare select is only as
 * wide as its widest option, so "PDF"/"Excel" collapsed to a stub while the field
 * beside it filled the row. This is the one dropdown box.
 */
export const selectClass = `block min-h-10 w-full py-2 pl-3 pr-9 ${FIELD_BOX}`;

/**
 * The same select sized to its content, for a toolbar or filter row rather than a
 * form column — a company switcher next to its label, an export format next to its
 * button. The floor is what stops those from shrinking to a stub; without a ceiling
 * on the options, a long site name is still allowed to make the control wider.
 */
export const inlineSelectClass = `block min-h-10 min-w-[10rem] py-2 pl-3 pr-9 ${FIELD_BOX}`;

/** A select inside a dense table cell, where a full-height field would grow the row. */
export const compactSelectClass = `block w-full py-1 pl-2 pr-7 ${FIELD_BOX}`;

/** A labelled text input. Native `<label htmlFor>` so clicking the label focuses the
 * field and screen readers announce it (spec FR-024). */
export function TextField({
  id,
  label,
  error,
  hint,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`]
    .filter(Boolean)
    .join(' ');
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
        className={clsx(fieldClass, error && 'border-red-500')}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1 text-xs text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Reserves the height of a field's label, so a bare control sits level with the inputs beside it.
 *
 * A row of fields aligned with `items-end` is thrown out by the first field that carries a hint:
 * the hint makes that column taller, bottom-aligning pushes that field's input *up*, and every
 * neighbouring label drops. Aligning the row to the top instead keeps the inputs on one line and
 * lets hints hang below where they belong — and then a button, which has no label, needs this to
 * land on that line rather than at the top of the row.
 *
 * A non-breaking space rather than a fixed height: it tracks whatever the label's type and spacing
 * are, so the two cannot drift apart.
 */
export function FieldLabelSpacer() {
  return (
    <span aria-hidden="true" className="mb-1 block text-sm font-medium">
      &nbsp;
    </span>
  );
}

/** A labelled select. */
export function SelectField({
  id,
  label,
  error,
  hint,
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  error?: string;
  /** Added by 006, matching `TextField`: a disabled or constrained select needs to
   * say *why* under itself, not leave the reader to guess. */
  hint?: string;
}) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`]
    .filter(Boolean)
    .join(' ');
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
        className={clsx(selectClass, error && 'border-red-500')}
      >
        {children}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          className="mt-1 text-xs text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** A labelled checkbox — a real `<input type="checkbox">`, not a styled div, so it
 * is focusable and toggles with Space out of the box. */
export function CheckboxField({
  id,
  label,
  description,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        {...rest}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-accent-500"
      />
      <div>
        <label htmlFor={id} className="text-sm text-gray-700">
          {label}
        </label>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
    </div>
  );
}

/** Secondary action button, matching `app/ui/button.tsx`'s focus treatment. */
export function SecondaryButton({
  children,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={clsx(
        // 44px below `sm`, the design's 40px above it — see `Button`, which does the same for the
        // same reason. A Cancel that is hard to hit is how somebody submits a form they meant to
        // abandon.
        // 2026-10-14: the same `gap-2`, shadow and accent focus as `Button`, and a border that
        // picks up the brand on hover so it reads as a control rather than a box.
        'flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 sm:h-10 sm:justify-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {rest.disabled && labelText(children).trim().endsWith('…') && <Spinner />}
      {children}
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
const ROW_ACTION =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 disabled:cursor-not-allowed disabled:opacity-40';

const DESTRUCTIVE = /^(delete|remove|discard)\b/i;

export function RowAction({
  children,
  className,
  intent = 'write',
  icon,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  intent?: 'write' | 'read';
  /** The icon beside the label; chosen from the label's verb when not given, `null` for none. */
  icon?: ActionIcon | null;
}) {
  const canWrite = useCanWrite();
  if (intent === 'write' && !canWrite) return null;
  return (
    <button
      {...rest}
      className={clsx(
        ROW_ACTION,
        // A destructive action warns on hover rather than inviting like the others.
        DESTRUCTIVE.test(labelText(children).trim()) &&
          'hover:border-red-300 hover:bg-red-50 hover:text-red-700',
        className,
      )}
    >
      <ActionGlyph label={children} icon={icon} />
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

/** Server-rejection banner shown at the top of a form, leaving entered data intact
 * (spec FR-022). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </p>
  );
}
