import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AppUpdateToast } from './AppUpdateToast';

/** offlineReady の通知は一度だけ、控えめに（自動で消える）出す */
const OFFLINE_READY_VISIBLE_MS = 6000;

/**
 * Service Worker の更新を購読して、待機中の新版があればトーストで知らせる。
 * 「更新」で skipWaiting し、新しい Service Worker が制御を取ったらリロードする
 * （reload は vite-plugin-pwa の registerSW が controlling イベントで行う）。
 */
export function AppUpdateNotice() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineReady) return undefined;
    const timer = window.setTimeout(() => setOfflineReady(false), OFFLINE_READY_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (needRefresh) {
    return (
      <AppUpdateToast
        open
        title="新しいバージョンがあります"
        description="更新すると、最新のレッスンと修正が反映されます。"
        actionLabel="更新"
        onAction={() => {
          void updateServiceWorker(true);
        }}
        dismissLabel="後で"
        onDismiss={() => setNeedRefresh(false)}
      />
    );
  }

  return (
    <AppUpdateToast
      open={offlineReady}
      title="オフラインでも使えます"
      description="レッスンと実行エンジンを保存しました。通信がなくても開けます。"
    />
  );
}
