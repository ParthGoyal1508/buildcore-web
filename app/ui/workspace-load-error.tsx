'use client';

import { ArrowPathIcon, CloudIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/app/ui/button';

/**
 * Shown by a guard when it could not find out who the caller is — not that they were refused
 * (036 A5).
 *
 * Every module guard and layout used to answer a failed `/users/me` with the lock-icon "Access
 * denied". Offline, or with the API restarting, a person who had every permission was told they had
 * none, with no way forward but a hard reload. Access denied stays for a real refusal; a failure to
 * load says so and offers Retry, which refetches `['currentUser']` — every guard reads that one
 * query, so all of them recover together.
 */
export default function WorkspaceLoadError() {
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await queryClient.refetchQueries({ queryKey: ['currentUser'] });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg bg-gray-50 p-8 text-center"
    >
      <CloudIcon className="w-10 text-gray-400" aria-hidden="true" />
      <h1 className="text-xl font-medium text-gray-900">
        Couldn’t load your workspace
      </h1>
      <p className="text-sm text-gray-600">
        Check your connection and try again. Nothing you had saved is affected.
      </p>
      <Button
        type="button"
        intent="read"
        onClick={retry}
        loading={retrying}
        className="mt-1"
      >
        {!retrying && <ArrowPathIcon aria-hidden="true" className="h-4 w-4" />}
        {retrying ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  );
}
