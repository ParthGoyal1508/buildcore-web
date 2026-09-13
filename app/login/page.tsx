import LoginForm from '@/app/ui/login-form';
import Logo from '@/app/ui/logo';
import { MESSAGES } from '@/app/lib/constants';
import {
  SESSION_COOKIE_MISSING,
  SESSION_EXPIRED,
  SESSION_REVOKED,
} from '@/app/lib/session-codes';

/**
 * Why the previous session ended, keyed by the code the API sent (015 FR-011).
 *
 * `withAuth` puts the code in the URL on its way here. Until now nothing read it, so a
 * user whose session had just been refused arrived at an unexplained sign-in form —
 * FR-011's requirement was half-built, and the missing half is exactly the part the
 * person in front of the screen sees.
 *
 * Keyed on the code and never on prose, matching how every other refusal in this app is
 * handled. An unrecognised value renders nothing rather than guessing, since the reason
 * arrives in a URL anyone can type.
 */
const SESSION_ENDED_MESSAGES: Record<string, string> = {
  [SESSION_EXPIRED]: MESSAGES.sessionExpired,
  [SESSION_REVOKED]: MESSAGES.sessionRevoked,
  [SESSION_COOKIE_MISSING]: MESSAGES.sessionCookieMissing,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ activated?: string; reason?: string }>;
}) {
  const { activated, reason } = await searchParams;
  const sessionEnded = reason ? SESSION_ENDED_MESSAGES[reason] : undefined;

  return (
    <main className="flex items-center justify-center md:h-screen">
      <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4 md:-mt-32">
        <div className="flex h-20 w-full items-center rounded-lg bg-blue-600 p-4 md:h-28">
          <Logo knockout priority className="h-8 md:h-10" />
        </div>
        {activated === '1' && (
          <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
            Account activated — log in with your new password.
          </p>
        )}
        {sessionEnded && (
          // `role="status"`: it explains a navigation the user did not ask for, so a
          // screen-reader user needs it announced rather than left to be discovered.
          <p
            role="status"
            className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            {sessionEnded}
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
