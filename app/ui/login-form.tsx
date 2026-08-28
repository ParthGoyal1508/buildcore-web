'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { lusitana } from '@/app/ui/fonts';
import {
  UserIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { Button } from './button';
import { login } from '@/app/lib/api/auth';
import { ApiError } from '@/app/lib/api/client';
import { ROUTES } from '@/app/lib/constants';
import { markJustLoggedIn } from '@/app/lib/session';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean(),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  });

  async function onSubmit(data: LoginValues) {
    setServerError(null);
    try {
      const result = await login(data.identifier, data.password, data.rememberMe);
      // replace, not push: once signed in, the login page shouldn't be a
      // step the back button can return to (research.md route-protection
      // intent extended to this direction too).
      if (result.mustChangePassword) {
        // Password-change is a separate, not-yet-built feature — routed to a
        // placeholder path per spec.md edge case / tasks.md T018a.
        router.replace(ROUTES.changePassword);
        return;
      }
      // The name deliberately does NOT travel in the URL: a history entry
      // outlives the session that created it, so after a logout-and-switch
      // the back button rendered the previous user's name. The dashboard
      // resolves it from the live session instead (welcome-banner.tsx).
      markJustLoggedIn();
      router.replace(ROUTES.dashboard);
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : 'Something went wrong.',
      );
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex-1 rounded-lg bg-gray-50 px-6 pb-4 pt-8">
        <h1 className={`${lusitana.className} mb-3 text-2xl`}>
          Please log in to continue.
        </h1>
        <div className="w-full">
          <div>
            <label
              className="mb-3 mt-5 block text-xs font-medium text-gray-900"
              htmlFor="identifier"
            >
              Email or Username
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 text-sm outline-2 placeholder:text-gray-500"
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="Enter your email or username"
                {...register('identifier')}
              />
              <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
            </div>
            {errors.identifier && (
              <p className="mt-1 text-xs text-red-600">{errors.identifier.message}</p>
            )}
          </div>
          <div className="mt-4">
            <label
              className="mb-3 mt-5 block text-xs font-medium text-gray-900"
              htmlFor="password"
            >
              Password
            </label>
            <div className="relative">
              <input
                className="peer block w-full rounded-md border border-gray-200 py-[9px] pl-10 pr-10 text-sm outline-2 placeholder:text-gray-500"
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter password"
                {...register('password')}
              />
              <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-[18px] w-[18px]" />
                ) : (
                  <EyeIcon className="h-[18px] w-[18px]" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-900">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                {...register('rememberMe')}
              />
              Remember me
            </label>
            <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
              Forgot Password?
            </Link>
          </div>
        </div>
        {/* `disabled`, not just `aria-disabled`: the latter styles the button
            but doesn't block the click, so a double-click fired two logins —
            burning two of the five lockout attempts on one wrong password
            (spec.md edge case: only one attempt should be counted). */}
        <Button className="mt-4 w-full" disabled={isSubmitting} aria-disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log in'}{' '}
          <ArrowRightIcon className="ml-auto h-5 w-5 text-gray-50" />
        </Button>
        <div className="flex min-h-8 items-start space-x-1 pt-1">
          {serverError && (
            <>
              <ExclamationCircleIcon className="h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm text-red-600">{serverError}</p>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
