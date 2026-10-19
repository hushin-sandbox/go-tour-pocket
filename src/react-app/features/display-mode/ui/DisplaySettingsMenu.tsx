import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/react-app/shared/lib';
import {
  DISPLAY_MODES,
  DISPLAY_MODE_LABELS,
  FONT_SIZES,
  FONT_SIZE_LABELS,
} from '../model/display-settings';
import { useDisplaySettings } from '../model/display-settings-context';

const segmentClass = (selected: boolean) =>
  cn(
    'min-h-11 rounded-md px-2 text-sm font-medium transition-colors outline-none',
    'focus-visible:ring-3 focus-visible:ring-ring/50',
    selected
      ? 'bg-background text-foreground shadow-sm'
      : 'text-muted-foreground hover:text-foreground',
  );

/**
 * Header に置く表示設定の入口。レッスン画面の本文に効く設定（対訳の組み合わせと
 * 文字サイズ）を 1 か所にまとめる。開いた先は、スマホではボトムシート、
 * 幅の広い画面では中央のダイアログになる。
 */
export function DisplaySettingsMenu() {
  const { settings, setMode, setFontSize } = useDisplaySettings();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="表示設定"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <SlidersHorizontal aria-hidden className="size-5" />
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="display-settings-heading"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none rounded-t-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-sm sm:rounded-2xl"
      >
        <div className="flex flex-col gap-5 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          <div className="flex items-center justify-between gap-2">
            <h2 id="display-settings-heading" className="text-base font-semibold">
              表示設定
            </h2>
            <button
              type="button"
              aria-label="表示設定を閉じる"
              onClick={() => setOpen(false)}
              className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">表示モード</h3>
            <div
              role="group"
              aria-label="表示モード"
              className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
            >
              {DISPLAY_MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.mode === value}
                  onClick={() => setMode(value)}
                  className={cn(segmentClass(settings.mode === value), 'min-w-0 flex-1')}
                >
                  {DISPLAY_MODE_LABELS[value]}
                </button>
              ))}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              レッスン本文の英語と日本語の組み合わせを選びます。
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">文字サイズ</h3>
            <div
              role="group"
              aria-label="文字サイズ"
              className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
            >
              {FONT_SIZES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={settings.fontSize === value}
                  onClick={() => setFontSize(value)}
                  className={cn(segmentClass(settings.fontSize === value), 'min-w-0 flex-1')}
                >
                  {FONT_SIZE_LABELS[value]}
                </button>
              ))}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              レッスン本文の文字サイズです。
            </p>
          </section>
        </div>
      </dialog>
    </>
  );
}
