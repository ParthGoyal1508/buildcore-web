import { lusitana } from '@/app/ui/fonts';
import LoginForm from '@/app/ui/login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ activated?: string }>;
}) {
  const { activated } = await searchParams;

  return (
    <main className="flex items-center justify-center md:h-screen">
      <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-2.5 p-4 md:-mt-32">
        <div className="flex h-20 w-full items-end rounded-lg bg-blue-600 p-3 md:h-36">
          <p className={`${lusitana.className} text-2xl text-white`}>
            BuildCore
          </p>
        </div>
        {activated === '1' && (
          <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
            Account activated — log in with your new password.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
