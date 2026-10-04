import { z } from 'zod';

/**
 * Parsing a response whose cash amounts the server has hidden (019 FR-014, FR-015).
 *
 * **This existed as a bug, not a gap.** When a company turns cash hiding on, the backend's
 * `CashVisibilityInterceptor` replaces a cash row's amount with `null` and adds
 * `amountHidden: true` beside it. Every money field in this client was `decimal` — a union of
 * number and string — so `null` failed the union and `parse` **threw**. The payments list did not
 * render a blank amount; it did not render at all. The same for a payment sheet containing one
 * cash disbursement.
 *
 * That is the fourth time this cycle the server and these schemas disagreed about a field, after
 * `ApiError.details`, the project-document `missingTypeIds`, and `grants` — and the first where
 * the disagreement broke a screen rather than quietly dropping something. The pattern is the
 * same every time: a zod object is a contract, and a field it does not name is a field it either
 * discards or rejects. Read the raw response before concluding what the API sends.
 *
 * Only the fields the interceptor can actually reach use these. Widening every money field to
 * nullable would hide the next genuine null — a missing figure and a concealed one are different
 * facts, and `amountHidden` is what distinguishes them.
 */

/** A money field the server may replace with `null` because the row is a cash transaction. */
export const hideableDecimal = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) =>
    value === null
      ? null
      : typeof value === 'number'
        ? value
        : value.trim() === ''
          ? null
          : Number(value),
  )
  .refine((value) => value === null || !Number.isNaN(value), {
    message: 'Not a number',
  });

/**
 * The server's marker that a figure was concealed rather than absent.
 *
 * `.optional()` and not `.default(false)`: absent means the server said nothing, which is the
 * normal case for every company that has not turned hiding on, and a default would make
 * "not hidden" and "never asked" indistinguishable in the type.
 */
export const amountHidden = z.boolean().optional();

/**
 * How a concealed figure reads on screen.
 *
 * Not an em dash. `rupees(null)` already renders one, and an em dash is what this interface shows
 * for *no amount recorded* — which is a different statement, and the one a reader will assume.
 * Somebody looking at a hidden cash payment should be able to tell that there is a figure and
 * that they are not being shown it.
 */
export const HIDDEN_AMOUNT = 'Hidden';

/**
 * A money figure, or the fact that it was hidden.
 *
 * Takes the formatter rather than importing one, because the two in this codebase disagree about
 * decimals (`rupees` keeps two, `formatRupees` keeps none) and a column must not change shape
 * depending on whether a row was cash.
 */
export function amountOrHidden(
  value: number | null | undefined,
  hidden: boolean | undefined,
  format: (value: number) => string,
): string {
  if (hidden && (value === null || value === undefined)) return HIDDEN_AMOUNT;
  if (value === null || value === undefined) return '—';
  return format(value);
}
