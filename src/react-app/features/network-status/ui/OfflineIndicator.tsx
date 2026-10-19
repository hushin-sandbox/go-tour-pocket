import { WifiOff } from 'lucide-react';

export type OfflineIndicatorProps = {
  /** 通信できるか。オンラインのときは何も描画しない */
  online: boolean;
};

/** ヘッダに置く、オフライン中だけ出る小さな表示。 */
export function OfflineIndicator({ online }: OfflineIndicatorProps) {
  if (online) return null;

  return (
    <span
      role="status"
      className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground"
    >
      <WifiOff aria-hidden className="size-3" />
      オフライン
    </span>
  );
}
