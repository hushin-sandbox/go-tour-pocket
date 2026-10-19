import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AppUpdateToast } from './AppUpdateToast';

/** offlineReady の通知は一度だけ、控えめに（自動で消える）出す */
const OFFLINE_READY_VISIBLE_MS = 6000;

/** アプリを開いたままでも更新に気づけるよう、1 時間ごとに sw.js を確認する */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Service Worker を autoUpdate で登録する。
 *
 * 新しい Service Worker は install 後すぐ skipWaiting + clientsClaim で制御を取り、
 * vite-plugin-pwa の registerSW が activated を検知してページをリロードする。
 * ここでは offlineReady の控えめな通知と、更新確認のきっかけ（1 時間ごとと、
 * タブが再表示されたとき）だけを持つ。
 */
export function AppUpdateNotice() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const {
    offlineReady: [offlineReady, setOfflineReady],
  } = useRegisterSW({
    onRegisteredSW(_swUrl, swRegistration) {
      setRegistration(swRegistration ?? null);
    },
  });

  useEffect(() => {
    if (!offlineReady) return undefined;
    const timer = window.setTimeout(() => setOfflineReady(false), OFFLINE_READY_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (registration === null) return undefined;
    const checkForUpdate = () => {
      // オフラインで呼ぶと必ず失敗するので、そのときは次の機会に任せる
      if (!navigator.onLine) return;
      void registration.update().catch(() => {
        // 一時的な失敗も次の確認（1 時間後・再表示時）に任せる
      });
    };
    const interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [registration]);

  return (
    <AppUpdateToast
      open={offlineReady}
      title="オフラインでも使えます"
      description="レッスンと実行エンジンを保存しました。通信がなくても開けます。"
    />
  );
}
