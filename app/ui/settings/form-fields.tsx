'use client';

import clsx from 'clsx';

import { useCanWrite } from '@/app/lib/write-access';

const FIELD_BOX =
  'rounded-md border border-gray-200 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:bg-gray-50 disabled:text-gray-500';

/** The box a text input, textarea or date field gets. Exported for the handful of
 *  screens that build their own labelled field rather than using `TextField`. */
export const fieldClass = `block w-full py-2 px-3 placeholder:text-gray-500 ${FIELD_BOX}`;

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
export const selectClass = `block w-full py-2 pl-3 pr-9 ${FIELD_BOX}`;

/**
 * The same select sized to its content, for a toolbar or filter row rather than a
 * form column — a company switcher next to its label, an export format next to its
 * button. The floor is what stops those from shrinking to a stub; without a ceiling
 * on the options, a long site name is still allowed to make the control wider.
 */
export const inlineSelectClass = `block min-w-[10rem] py-2 pl-3 pr-9 ${FIELD_BOX}`;

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
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
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
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600" role="alert">
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
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
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
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600" role="alert">
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
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
        'flex h-11 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:h-10 sm:justify-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
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
export function RowAction({
  children,
  className,
  intent = 'write',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  intent?: 'write' | 'read';
}) {
  const canWrite = useCanWrite();
  if (intent === 'write' && !canWrite) return null;
  return (
    <button
      {...rest}
      className={clsx(
        'rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Server-rejection banner shown at the top of a form, leaving entered data intact
 * (spec FR-022). */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
    >
      {message}
    </p>
  );
}
