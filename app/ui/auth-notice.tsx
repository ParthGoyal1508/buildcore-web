import Link from 'next/link';
import { lusitana } from '@/app/ui/fonts';
import { ROUTES } from '@/app/lib/constants';

/**
 * Shared shell for the auth-adjacent pages that aren't built yet, so a user
 * routed here lands on a real explanation with a way back rather than a 404.
 * Mirrors the login page's layout so the transition doesn't feel broken.
 */
export default function AuthNotice({
  title,
  children,
  backLabel = 'Back to login',
}: {
  title: string;
  children: React.ReactNode;
  backLabel?: string;
}) {
  return (
    <main className="flex items-center justify-center md:h-screen">
      <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4 md:-mt-32">
        <div className="flex h-20 w-full items-end rounded-lg bg-blue-600 p-3 md:h-36">
          <p className={`${lusitana.className} text-2xl text-white`}>BuildCore</p>
        </div>
        <div className="flex-1 rounded-lg bg-gray-50 px-6 pb-6 pt-8">
          <h1 className={`${lusitana.className} mb-3 text-2xl`}>{title}</h1>
          <div className="space-y-3 text-sm text-gray-600">{children}</div>
          <Link
            href={ROUTES.login}
            className="mt-6 inline-block text-sm text-blue-600 hover:underline"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
