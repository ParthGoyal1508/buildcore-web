import type { Metadata } from 'next';
import AuthNotice from '@/app/ui/auth-notice';
import ChangePasswordForm from '@/app/ui/change-password-form';

export const metadata: Metadata = { title: 'Change Password' };

/**
 * The mandatory password-change step (001 FR-007, 010 FR-017c).
 *
 * Reached when a login returns `mustChangePassword: true` — an administrator either
 * reset this account's password or created the account with one. Either way the
 * value in force was chosen by someone else, and for a directly-created account the
 * server refuses every non-exempt request until it is replaced.
 *
 * This was a placeholder until 010's 2026-09-01 amendment: it explained the
 * situation and offered no way out of it, which was survivable only because nothing
 * enforced the flag.
 */
export default function ChangePasswordPage() {
  return (
    <AuthNotice title="Password change required" backLabel="Back to login">
      <p>
        Your administrator set the password you just used. Choose your own before
        continuing — until you do, the rest of the app is unavailable.
      </p>
      <ChangePasswordForm />
    </AuthNotice>
  );
}
