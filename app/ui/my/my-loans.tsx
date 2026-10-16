'use client';

import { useQuery } from '@tanstack/react-query';

import { getMyLoans, getMySalaryAdvances } from '@/app/lib/api/my-workspace';
import { dateLabel, money, periodLabel } from '@/app/lib/format';
import StatusBadge from '@/app/ui/status-badge';
import { LoadingText } from '@/app/ui/spinner';

/**
 * The employee's own loans and salary advances (2026-10-16, My Workspace): how much, how much is
 * repaid, and the EMI schedule month by month — the figures payroll deducts, read from the same
 * records the Loans and Salary Advances screens keep.
 */
export default function MyLoans() {
  const loans = useQuery({ queryKey: ['my', 'loans'], queryFn: getMyLoans });
  const advances = useQuery({
    queryKey: ['my', 'salary-advances'],
    queryFn: getMySalaryAdvances,
  });

  if (loans.isPending || advances.isPending) {
    return (
      <p className="text-sm text-gray-500" role="status">
        <LoadingText />
      </p>
    );
  }
  if (loans.isError || advances.isError) {
    return (
      <p className="text-sm text-red-700" role="alert">
        Could not load your loans and advances.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-medium text-gray-900">Loans</h2>
        {loans.data.length === 0 ? (
          <p className="text-sm text-gray-500">You have no loans.</p>
        ) : (
          loans.data.map((loan) => (
            <article
              key={loan.id}
              className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {money(loan.amount)}
                  </p>
                  <p className="text-sm text-gray-600">{loan.reason}</p>
                  <p className="text-xs text-gray-500">
                    Disbursed {dateLabel(loan.disbursementDate)} · EMI{' '}
                    {money(loan.emiAmount)} × {loan.instalments}
                  </p>
                </div>
                <StatusBadge status={loan.status} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Repaid</dt>
                  <dd className="font-medium text-gray-900">
                    {money(loan.totalRecovered)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Outstanding</dt>
                  <dd className="font-medium text-gray-900">
                    {money(loan.outstanding)}
                  </dd>
                </div>
              </dl>
              <details>
                <summary className="cursor-pointer text-sm text-blue-700">
                  EMI schedule
                </summary>
                <ul className="mt-2 divide-y divide-gray-100 text-sm">
                  {loan.schedule.map((emi) => (
                    <li
                      key={emi.month}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span>{periodLabel(emi.month)}</span>
                      <span className="flex items-center gap-2">
                        {money(emi.emiAmount)}
                        <StatusBadge status={emi.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-gray-900">Salary advances</h2>
        {advances.data.length === 0 ? (
          <p className="text-sm text-gray-500">You have no salary advances.</p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {advances.data.map((advance) => (
              <li
                key={advance.id}
                className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {money(advance.amount)} · {advance.reason}
                  </p>
                  <p className="text-xs text-gray-500">
                    Recovered from {periodLabel(advance.recoveryMonth)} salary ·{' '}
                    {money(advance.outstandingBalance)} outstanding
                  </p>
                </div>
                <StatusBadge status={advance.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
