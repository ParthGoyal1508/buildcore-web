import type { Metadata } from 'next';
import AuthNotice from '@/app/ui/auth-notice';
import ForgotPasswordForm from '@/app/ui/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Forgot Password' };

/**
 * Forgot Password (029 FR-010). Public — outside proxy.ts's session matcher, since the person
 * here cannot sign in.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthNotice title="Forgot your password?">
      <ForgotPasswordForm />
    </AuthNotice>
  );
}
