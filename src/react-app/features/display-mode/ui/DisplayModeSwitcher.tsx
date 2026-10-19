import { Button } from '@/react-app/shared/ui';
import { cn } from '@/react-app/shared/lib';
import {
  DISPLAY_MODES,
  DISPLAY_MODE_LABELS,
  FONT_SIZE_LABELS,
  type DisplayMode,
  type FontSize,
} from '../model/display-settings';

type DisplayModeSwitcherProps = {
  mode: DisplayMode;
  fontSize: FontSize;
  onModeChange: (mode: DisplayMode) => void;
  onFontSizeChange: () => void;
};

export function DisplayModeSwitcher({
  mode,
  fontSize,
  onModeChange,
  onFontSizeChange,
}: DisplayModeSwitcherProps) {
  return (
    <div className="flex w-full items-center gap-2">
      <div
        role="group"
        aria-label="表示モード"
        className="flex min-w-0 flex-1 items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
      >
        {DISPLAY_MODES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => onModeChange(value)}
            className={cn(
              'min-h-11 min-w-0 flex-1 rounded-md px-1.5 text-xs font-medium transition-colors',
              mode === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {DISPLAY_MODE_LABELS[value]}
          </button>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onFontSizeChange}
        aria-label={`文字サイズ: ${FONT_SIZE_LABELS[fontSize]}（押すと変更）`}
        className="min-h-11 shrink-0 gap-1 px-2.5"
      >
        <span aria-hidden className="text-xs text-muted-foreground">
          文字
        </span>
        <span className="text-xs font-semibold">{FONT_SIZE_LABELS[fontSize]}</span>
      </Button>
    </div>
  );
}
