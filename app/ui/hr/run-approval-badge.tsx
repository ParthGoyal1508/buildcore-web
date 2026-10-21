import type { PayrollRun } from '@/app/lib/api/hr-payroll';
import type { StatusTone } from '@/app/lib/status-tones';
import StatusBadge from '@/app/ui/status-badge';

/**
 * Where a payroll run stands with the Director (039), in HR's words rather than the spine's: a
 * returned run is HR's to correct and send again, and "abandoned" — an attendance change voiding
 * the approval — reads to HR as "send it again", so it says so.
 */
const STATES: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: 'With Director', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  returned: { label: 'Returned', tone: 'danger' },
  rejected: { label: 'Rejected', tone: 'danger' },
  abandoned: { label: 'Send again', tone: 'neutral' },
};

export default function RunApprovalBadge({ run }: { run: PayrollRun }) {
  const state = run.approval?.state;
  if (!state) {
    // A paid or processed run never sent predates 039; nothing to say beyond the dash.
    return run.status === 'draft' ? (
      <StatusBadge label="Not sent" tone="neutral" />
    ) : (
      <span className="text-sm text-gray-500">—</span>
    );
  }
  const { label, tone } = STATES[state] ?? { label: state, tone: 'neutral' };
  return <StatusBadge label={label} tone={tone} />;
}
