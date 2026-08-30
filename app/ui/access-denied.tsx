import { LockClosedIcon } from '@heroicons/react/24/outline';
import { lusitana } from '@/app/ui/fonts';
import { MESSAGES } from '@/app/lib/constants';

/**
 * Shown in place of a Settings page whose required permission the signed-in user
 * doesn't hold. A UX courtesy only — the backend rejects the same request with a
 * 403 regardless of what this component does.
 */
export default function AccessDenied({ detail }: { detail?: string }) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg bg-gray-50 p-8 text-center"
    >
      <LockClosedIcon className="w-10 text-gray-400" aria-hidden="true" />
      <h1 className={`${lusitana.className} text-xl`}>
        {MESSAGES.accessDeniedTitle}
      </h1>
      <p className="text-sm text-gray-600">{detail ?? MESSAGES.accessDeniedBody}</p>
    </div>
  );
}
