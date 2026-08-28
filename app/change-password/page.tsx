import type { Metadata } from 'next';
import AuthNotice from '@/app/ui/auth-notice';

export const metadata: Metadata = { title: 'Change Password' };

/**
 * Placeholder for the mandatory password-change step (spec FR-007). Reached
 * when a login succeeds with `mustChangePassword: true` — which today means an
 * administrator issued a temporary password for this account. The change form
 * itself is a separate feature; this page exists so that user lands on an
 * explanation rather than a 404.
 */
export default function ChangePasswordPage() {
  return (
    <AuthNotice title="Password change required" backLabel="Back to login">
      <p>
        Your administrator has set a temporary password for your account. You
        need to choose a new one before you can continue.
      </p>
      <p>
        This screen isn&apos;t built yet — until it is, contact your
        administrator to complete the change.
      </p>
    </AuthNotice>
  );
}
