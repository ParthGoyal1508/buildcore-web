'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { lusitana } from '@/app/ui/fonts';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { ArrowRightIcon } from '@heroicons/react/20/solid';
import { Button, IconButton } from '@/app/ui/button';
import { FormError, TextField } from '@/app/ui/settings/form-fields';
import { login } from '@/app/lib/api/auth';
import { ApiError, NETWORK_ERROR, TIMEOUT_ERROR } from '@/app/lib/api/client';
import { getCurrentUser } from '@/app/lib/api/users';
import { ROUTES } from '@/app/lib/constants';
import { homeRoute } from '@/app/lib/permissions';
import { safeReturnPath } from '@/app/lib/return-path';
import { markJustLoggedIn } from '@/app/lib/session';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Enter your email or username'),
  password: z.string().min(1, 'Enter your password'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginForm({
  next,
}: {
  /** Where the session ended, from `?next=` — honoured only as a same-origin path (036 A24). */
  next?: string;
} = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginValues) {
    setServerError(null);
    try {
      const result = await login(data.identifier, data.password);
      // replace, not push: once signed in, the login page shouldn't be a
      // step the back button can return to (research.md route-protection
      // intent extended to this direction too).
      if (result.mustChangePassword) {
        // An administrator chose the password in force; the API refuses everything else
        // until it is replaced (010 FR-017, 029 FR-016).
        router.replace(ROUTES.changePassword);
        return;
      }
      // The name deliberately does NOT travel in the URL: a history entry
      // outlives the session that created it, so after a logout-and-switch
      // the back button rendered the previous user's name. The dashboard
      // resolves it from the live session instead (welcome-banner.tsx).
      markJustLoggedIn();
      // Straight to this person's home (029 FR-021). Fetched into the shared cache rather than
      // thrown away: the shell asks for the same user the moment it renders, so this costs no
      // round trip overall — and on a site's connection that is the difference between landing
      // on My Workspace and watching Dashboard flash up and redirect.
      const user = await queryClient
        .fetchQuery({ queryKey: ['currentUser'], queryFn: getCurrentUser })
        .catch(() => null);
      // Back to where the session ended, when it ended somewhere (036 A24). The module guards
      // still decide whether this person may be there; a page they may not open sends them home.
      router.replace(
        safeReturnPath(next) ?? (user && homeRoute(user)) ?? ROUTES.dashboard,
      );
    } catch (err) {
      setServerError(signInFailure(err));
    }
  }

  return (
    // Built from the same `TextField`, `Button` and `FormError` as the reset and set-password
    // forms (036 A29), so the three screens a locked-out user moves between look like one app —
    // this one still wore the Next.js tutorial's inputs. Each field's error now sits on the field,
    // linked by `aria-describedby`; a refusal from the server is the `role="alert"` banner above.
    <form className="space-y-3" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="flex-1 rounded-lg bg-gray-50 px-6 pb-6 pt-8">
        <h1 className={`${lusitana.className} mb-3 text-2xl`}>
          Please log in to continue.
        </h1>
        <div className="space-y-4">
          <FormError message={serverError} />
          <TextField
            id="identifier"
            label="Email or Username"
            type="text"
            autoComplete="username"
            // A phone would otherwise capitalise and "correct" an email or username.
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            enterKeyHint="next"
            placeholder="Enter your email or username"
            aria-required
            error={errors.identifier?.message}
            {...register('identifier')}
          />
          <TextField
            id="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter password"
            aria-required
            error={errors.password?.message}
            {...register('password')}
            trailing={
              <IconButton
                size="sm"
                label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <EyeSlashIcon aria-hidden="true" className="h-[18px] w-[18px]" />
                ) : (
                  <EyeIcon aria-hidden="true" className="h-[18px] w-[18px]" />
                )}
              </IconButton>
            }
          />
          {/* "Remember me" is gone (015 FR-005). It was unexplained, defaulted to
              unticked, and 74 of 89 sign-ins left it that way — which bought them a
              session that ended when they closed the browser. Every session now lasts
              the same 90 days, so there is nothing left to ask. */}
          <div className="flex items-center justify-end">
            <Link
              href={ROUTES.forgotPassword}
              className="rounded text-sm text-brand-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
            >
              Forgot Password?
            </Link>
          </div>
        </div>
        {/* `disabled`, not just `aria-disabled`: the latter styles the button
            but doesn't block the click, so a double-click fired two logins —
            burning two of the five lockout attempts on one wrong password
            (spec.md edge case: only one attempt should be counted). */}
        <Button
          type="submit"
          intent="read"
          className="mt-6 w-full"
          loading={isSubmitting}
        >
          {isSubmitting ? 'Logging in…' : 'Log in'}
          <ArrowRightIcon aria-hidden="true" className="ml-auto h-5 w-5 text-gray-50" />
        </Button>
      </div>
    </form>
  );
}

/**
 * What a failed sign-in says (036 A29), by what actually went wrong — it used to be "Something went
 * wrong." for everything that was not an API refusal, which told somebody on a site with one bar
 * of signal nothing about whether to retry, move, or call the office.
 *
 * - Refusals (wrong password, locked, rate-limited) already carry this app's copy from `login()`.
 * - No connection or a timeout carry theirs from the API client (036 A2), and an offline browser is
 *   named as such before the request is even blamed.
 * - A 5xx is the server's fault, not the person's, and says so.
 * - Anything else — an answer the app could not read — is the one generic case left.
 */
function signInFailure(err: unknown): string {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You are offline. Connect to the internet and try again.';
  }
  if (err instanceof ApiError) {
    if (err.code === NETWORK_ERROR || err.code === TIMEOUT_ERROR) return err.message;
    if (err.status >= 500) {
      return 'Tirupati Groups could not sign you in just now — the problem is on our side. Try again in a minute.';
    }
    return err.message;
  }
  return 'Tirupati Groups sent an answer this page could not read. Refresh the page and try again; if it keeps happening, tell your administrator.';
}
