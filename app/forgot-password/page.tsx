import type { Metadata } from 'next';
import AuthNotice from '@/app/ui/auth-notice';

export const metadata: Metadata = { title: 'Forgot Password' };

/**
 * Placeholder. The real flow — enter your registered email, receive a one-time
 * code, use it to set a new password — is its own feature and isn't built yet.
 * This page exists so the login page's "Forgot Password?" link lands somewhere
 * real instead of a 404.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthNotice title="Forgot your password?">
      <p>
        This feature isn&apos;t available yet. When it&apos;s ready, you&apos;ll
        enter your registered email address and receive a one-time code to reset
        your password.
      </p>
      <p>
        In the meantime, ask your administrator to reset it for you — they can
        issue a temporary password you&apos;ll change when you next sign in.
      </p>
    </AuthNotice>
  );
}
