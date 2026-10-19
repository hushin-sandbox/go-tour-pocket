import { RefreshCw } from 'lucide-react';
import { Button } from '@/react-app/shared/ui';

export type AppUpdateToastProps = {
  open: boolean;
  title: string;
  description?: string;
  /** 主アクション（更新トーストの「更新」など）。省略するとボタンを出さない */
  actionLabel?: string;
  onAction?: () => void;
  /** 閉じるボタン。省略すると閉じる手段を出さない（控えめな通知用） */
  dismissLabel?: string;
  onDismiss?: () => void;
};

/**
 * 画面下部のトースト。下部固定ナビと重ならないよう、位置は CSS 変数
 * `--toast-bottom-offset` で外から調整できる（既定は safe-area + 1rem）。
 */
export function AppUpdateToast({
  open,
  title,
  description,
  actionLabel,
  onAction,
  dismissLabel,
  onDismiss,
}: AppUpdateToastProps) {
  if (!open) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: 'var(--toast-bottom-offset, calc(env(safe-area-inset-bottom) + 1rem))' }}
    >
      <div
        role="status"
        aria-live="polite"
        className="animate-in fade-in slide-in-from-bottom-2 pointer-events-auto flex w-full max-w-md flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg duration-200"
      >
        <div className="flex flex-col gap-1">
          <p className="text-sm leading-6 font-medium">{title}</p>
          {description === undefined ? null : (
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
        {onDismiss === undefined && onAction === undefined ? null : (
          <div className="flex flex-wrap justify-end gap-2">
            {dismissLabel === undefined || onDismiss === undefined ? null : (
              <Button variant="ghost" className="h-11 px-4" onClick={onDismiss}>
                {dismissLabel}
              </Button>
            )}
            {actionLabel === undefined || onAction === undefined ? null : (
              <Button className="h-11 px-4" onClick={onAction}>
                <RefreshCw aria-hidden className="size-4" />
                {actionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
