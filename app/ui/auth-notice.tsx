import Link from 'next/link';
import { lusitana } from '@/app/ui/fonts';
import { ROUTES } from '@/app/lib/constants';
import Logo from '@/app/ui/logo';

/**
 * Shared shell for the auth-adjacent pages — Forgot Password, Reset Password, Change
 * Password. Mirrors the login page's layout so moving between them doesn't feel broken.
 */
export default function AuthNotice({
  title,
  children,
  backLabel = 'Back to login',
  backHref = ROUTES.login,
}: {
  title: string;
  children: React.ReactNode;
  backLabel?: string;
  /** Where the link under the card goes; `null` hides it, for a screen that supplies its own. */
  backHref?: string | null;
}) {
  return (
    <main className="flex items-center justify-center md:h-screen">
      <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4 md:-mt-32">
        <div className="flex h-20 w-full items-center rounded-lg bg-brand-600 p-4 md:h-28">
          <Logo knockout className="h-8 md:h-10" />
        </div>
        <div className="flex-1 rounded-lg bg-gray-50 px-6 pb-6 pt-8">
          <h1 className={`${lusitana.className} mb-3 text-2xl`}>{title}</h1>
          <div className="space-y-3 text-sm text-gray-600">{children}</div>
          {backHref && (
            <Link
              href={backHref}
              className="mt-6 inline-block text-sm text-brand-600 hover:underline"
            >
              {backLabel}
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
