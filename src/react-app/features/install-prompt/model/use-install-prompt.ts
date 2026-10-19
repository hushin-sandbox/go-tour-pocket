import { useCallback, useEffect, useState } from 'react';
import {
  dismissIosInstallGuide,
  isIosInstallGuideDismissed,
  type InstallPromptContext,
  type KeyValueStorage,
} from './install-prompt';

/**
 * Android / Chromium の beforeinstallprompt を捕まえて、あとから prompt() を
 * 呼べるように保持する。iOS はイベントが無いので、手順カードの閉じた記録だけ扱う。
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export type UseInstallPromptResult = {
  context: InstallPromptContext;
  /** Chromium 向け。インストールダイアログを開く */
  install: () => void;
  /** iOS 向け。手順カードを閉じて localStorage に記録する */
  dismiss: () => void;
};

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function';
}

function getLocalStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    // プライベートモードなどで localStorage に触れないことがある
    return null;
  }
}

function isStandaloneDisplay(): boolean {
  const displayMode =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false;
  const iosStandalone = 'standalone' in navigator && navigator.standalone === true;
  return displayMode || iosStandalone;
}

export function useInstallPrompt(): UseInstallPromptResult {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(isStandaloneDisplay);
  const [dismissed, setDismissed] = useState(() => isIosInstallGuideDismissed(getLocalStorage()));

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      if (!isBeforeInstallPromptEvent(event)) return;
      // 既定のミニ情報バーは出さず、こちらのボタンから prompt() を呼ぶ
      event.preventDefault();
      setInstallEvent(event);
    };
    const handleAppInstalled = () => {
      setInstallEvent(null);
      setStandalone(true);
    };
    // インストール後に standalone へ切り替わったことを検知する
    const displayModeQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : undefined;
    const handleDisplayModeChange = () => setStandalone(isStandaloneDisplay());

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    displayModeQuery?.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      displayModeQuery?.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(() => {
    if (installEvent === null) return;
    void (async () => {
      try {
        await installEvent.prompt();
        const { outcome } = await installEvent.userChoice;
        if (outcome === 'accepted') setStandalone(true);
      } catch {
        // ユーザー操作の外で prompt() を呼ぶと失敗する。カードは出したままにする
      } finally {
        setInstallEvent(null);
      }
    })();
  }, [installEvent]);

  const dismiss = useCallback(() => {
    dismissIosInstallGuide(getLocalStorage());
    setDismissed(true);
  }, []);

  return {
    context: {
      hasInstallEvent: installEvent !== null,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone,
      dismissed,
    },
    install,
    dismiss,
  };
}
