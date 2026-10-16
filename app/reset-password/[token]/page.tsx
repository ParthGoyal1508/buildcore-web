import type { Metadata } from 'next';
import AuthNotice from '@/app/ui/auth-notice';
import ResetPasswordForm from '@/app/ui/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Reset your password',
  // The token is in this page's URL. No referrer means a link followed from here cannot hand it
  // to another site, and no indexing keeps it out of anything that crawls what it is shown
  // (029 FR-012). next.config.ts sends the same as headers.
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

/**
 * Public — the person cannot sign in, which is why they are here — so this sits outside the
 * dashboard shell and outside proxy.ts's session matcher, as /set-password does.
 */
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <AuthNotice title="Choose a new password">
      <ResetPasswordForm token={token} />
    </AuthNotice>
  );
}
