import clsx from 'clsx';

import { BOQ_COPY } from '@/app/lib/constants';

/** A line's or a schedule's pricing basis, as a chip (047). */
export function BasisChip({
  basis,
}: {
  basis: 'percentage' | 'item_rate';
}) {
  return (
    <span
      title={BOQ_COPY.pricingBasisHint[basis]}
      className={clsx(
        'whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium',
        basis === 'item_rate'
          ? 'bg-violet-50 text-violet-800'
          : 'bg-sky-50 text-sky-800',
      )}
    >
      {BOQ_COPY.pricingBasis[basis]}
    </span>
  );
}
