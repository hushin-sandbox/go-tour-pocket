type AppUpdateToastProps = {
  open: boolean;
  title: string;
  description?: string;
};

/**
 * 画面下部のトースト。ナビは固定しないので、位置は safe-area + 1rem で足りる。
 */
export function AppUpdateToast({ open, title, description }: AppUpdateToastProps) {
  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="animate-in fade-in slide-in-from-bottom-2 pointer-events-auto flex w-full max-w-md flex-col gap-1 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg duration-200"
      >
        <p className="text-sm leading-6 font-medium">{title}</p>
        {description === undefined ? null : (
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
