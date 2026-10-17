'use client';

import { useEffect, useState } from 'react';
import { Button, SecondaryButton } from '@/app/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPrompt() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const prompt = event as BeforeInstallPromptEvent;
      event.preventDefault();
      setPromptEvent(prompt);
      setIsVisible(true);
    };

    const onAppInstalled = () => {
      setIsVisible(false);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!promptEvent) return;

    promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 md:bottom-4 rounded-xl border border-slate-200 bg-white p-4 shadow-lg md:left-auto md:right-4 md:max-w-sm">
      <p className="text-sm font-semibold text-slate-900">Install BuildCore</p>
      <p className="mt-1 text-sm text-slate-600">
        Add it to your home screen for faster access and offline use.
      </p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <SecondaryButton
          type="button"
          size="sm"
          onClick={() => setIsVisible(false)}
        >
          Later
        </SecondaryButton>
        <Button
          type="button"
          intent="read"
          size="sm"
          onClick={handleInstall}
        >
          Install
        </Button>
      </div>
    </div>
  );
}
