import { HIDDEN_AMOUNT } from '@/app/lib/api/cash-hiding';

/**
 * A cash figure the company has chosen to conceal (019 FR-014, T049).
 *
 * **A stated absence — never a blank cell, and never `0`.** The API returns `null` with
 * `amountHidden: true` beside it, and goes to that trouble for one reason: a zero is a figure, and
 * neither a reader nor a spreadsheet summing a column can tell a concealed amount from a real
 * zero. Rendering it as an empty cell throws the same information away a second time, because an
 * empty cell is what this app shows for *no amount recorded*.
 *
 * So the words appear. Somebody looking at this row should be able to tell that there is a figure
 * and that they are not being shown it — and that nothing is broken.
 */
export default function HiddenAmount({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={className ?? 'text-gray-500'}
      title="Hidden by this company's cash visibility setting. Nothing has been deleted."
    >
      {HIDDEN_AMOUNT}
    </span>
  );
}

/**
 * A total that spans at least one hidden row (FR-014, T051).
 *
 * **Says it is incomplete rather than presenting a figure that is quietly short.** A column total
 * computed over hidden rows understates itself by the value of every one of them, and a reader has
 * no way to know — which is precisely the arithmetic the API nulls rather than zeroes to prevent.
 * Having protected the figure all the way to the browser, adding the rows up here would undo it at
 * the last step.
 */
export function PartialTotal({
  total,
  format,
  className,
}: {
  /** The total of the rows that were *not* hidden. Shown, because it is true of those rows. */
  total: number;
  format: (value: number) => string;
  className?: string;
}) {
  return (
    <span
      className={className}
      title="Some cash amounts in this column are hidden, so this total covers only the visible rows."
    >
      {format(total)}
      <span className="ml-1 text-xs font-normal text-gray-500">
        (visible rows only)
      </span>
    </span>
  );
}
