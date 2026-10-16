import { passwordRules } from '@/app/lib/api/account-creation';

/**
 * Each password rule, ticked off as it is met (029 FR-005).
 *
 * Live and per-rule rather than one message after submitting: someone choosing a password —
 * often on a phone keyboard — should see which requirement is still unmet while they type.
 */
export default function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="space-y-1 text-sm" aria-live="polite">
      {passwordRules.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.label} className={met ? 'text-green-700' : 'text-gray-500'}>
            <span aria-hidden="true">{met ? '✓' : '○'}</span>{' '}
            <span>{rule.label}</span>
            <span className="sr-only">{met ? ' — met' : ' — not yet met'}</span>
          </li>
        );
      })}
    </ul>
  );
}
