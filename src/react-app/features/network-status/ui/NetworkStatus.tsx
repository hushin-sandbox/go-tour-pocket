import { useOnlineStatus } from '../model/use-online-status';
import { OfflineIndicator } from './OfflineIndicator';

/** ブラウザの通信状態を購読して OfflineIndicator を出す。 */
export function NetworkStatus() {
  const online = useOnlineStatus();
  return <OfflineIndicator online={online} />;
}
