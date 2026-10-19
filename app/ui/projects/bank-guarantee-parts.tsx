'use client';

import type {
  BgDisplayStatus,
  BgGuaranteeSummary,
  BgStatusFilter,
} from '@/app/lib/api/bank-guarantees';
import type { StatusTone } from '@/app/lib/status-tones';
import { dateLabel, rupees } from '@/app/lib/format';
import StatusBadge from '@/app/ui/status-badge';

/**
 * Shared pieces of the Bank Guarantees screens (037).
 */

/** The client's own word is "Running"; Expired is worked out from the dates by the api. */
export const BG_STATUS_LABELS: Record<BgDisplayStatus, string> = {
  RUNNING: 'Running',
  EXPIRED: 'Expired',
  RELEASED: 'Released',
  ENCASHED: 'Encashed',
};

export const BG_FILTER_LABELS: Record<BgStatusFilter, string> = {
  expiring: 'Expiring within 30 days',
  running: 'Running',
  expired: 'Expired',
  released: 'Released',
  encashed: 'Encashed',
};

/** What a guarantee's history entry says happened. */
export const BG_EVENT_LABELS: Record<string, string> = {
  created: 'Added',
  edited: 'Edited',
  extended: 'Extended',
  released: 'Released',
  encashed: 'Encashed',
  reopened: 'Reopened',
};

/** "₹20,43,000.00" from the api's decimal string; a dash when there is none. */
export function bgMoney(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return rupees(Number(value));
}

/**
 * The status as a badge. A Running guarantee inside the 30-day window says how long it has
 * left, in amber — the same window the alert uses — so the register answers "what needs
 * attention" without a filter.
 */
export function BgStatusBadge({
  status,
  daysToExpiry,
}: {
  status: BgDisplayStatus;
  daysToExpiry: number | null;
}) {
  if (status === 'RUNNING' && daysToExpiry !== null && daysToExpiry <= 30) {
    const label =
      daysToExpiry === 0
        ? 'Expires today'
        : `Expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}`;
    return <StatusBadge tone="warning" label={label} />;
  }
  const tone: Record<BgDisplayStatus, StatusTone> = {
    RUNNING: 'success',
    EXPIRED: 'danger',
    RELEASED: 'neutral',
    ENCASHED: 'danger',
  };
  return <StatusBadge tone={tone[status]} label={BG_STATUS_LABELS[status]} />;
}

/** One guarantee as a compact block, for the register's EMD and PBG cells. */
export function GuaranteeSummary({ bg }: { bg: BgGuaranteeSummary }) {
  return (
    <div className="flex flex-col gap-0.5 text-sm">
      <span className="font-medium tabular-nums text-gray-900">{bgMoney(bg.amount)}</span>
      <span className="break-all text-xs text-gray-600">
        {bg.bgNumber ?? 'Number not yet issued'}
      </span>
      {(bg.issueDate || bg.expiryDate) && (
        <span className="text-xs tabular-nums text-gray-600">
          {/* Each date kept whole: a narrow cell broke "02-12-2027" after the month. */}
          <span className="whitespace-nowrap">{dateLabel(bg.issueDate)}</span> →{' '}
          <span className="whitespace-nowrap">{dateLabel(bg.expiryDate)}</span>
        </span>
      )}
      <span className="mt-0.5">
        <BgStatusBadge status={bg.displayStatus} daysToExpiry={bg.daysToExpiry} />
      </span>
    </div>
  );
}

/** The guarantees of one type in a register cell, stacked; a dash when there are none. */
export function GuaranteeCell({ guarantees }: { guarantees: BgGuaranteeSummary[] }) {
  if (guarantees.length === 0) return <span className="text-gray-500">—</span>;
  return (
    <div className="flex flex-col gap-3">
      {guarantees.map((bg) => (
        <GuaranteeSummary key={bg.id} bg={bg} />
      ))}
    </div>
  );
}

/** Keeps only digits and one decimal point, for a rupee field typed by hand. */
export function amountInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
}
