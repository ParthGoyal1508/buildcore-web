'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
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
    <div className="fixed inset-x-4 bottom-4 z-50 rounded-xl border border-slate-200 bg-white p-4 shadow-lg md:left-auto md:right-4 md:max-w-sm">
      <p className="text-sm font-semibold text-slate-900">Install BuildCore</p>
      <p className="mt-1 text-sm text-slate-600">
        Add it to your home screen for faster access and offline use.
      </p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Later
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Install
        </button>
      </div>
    </div>
  );
}
