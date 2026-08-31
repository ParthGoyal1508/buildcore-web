import type { Metadata } from 'next';
import { lusitana } from '@/app/ui/fonts';
import SetPasswordForm from '@/app/ui/account-creation/set-password-form';

export const metadata: Metadata = { title: 'Set your password' };

/**
 * Public route — the recipient has no account to sign in with yet, which is why
 * this sits outside `/dashboard` and outside proxy.ts's session matcher, and why
 * it does not render the dashboard shell.
 */
export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-sm">
        <h1 className={`${lusitana.className} mb-4 text-2xl`}>
          Set your password
        </h1>
        <SetPasswordForm token={token} />
      </div>
    </main>
  );
}
