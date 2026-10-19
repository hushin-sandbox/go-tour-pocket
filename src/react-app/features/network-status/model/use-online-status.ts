import { useEffect, useState } from 'react';

/**
 * navigator.onLine と online / offline イベントから、いま通信できるかを返す。
 * navigator.onLine は「LAN に繋がっているか」しか分からないが、オフライン表示の
 * 目安としては十分なのでこれを使う。
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
