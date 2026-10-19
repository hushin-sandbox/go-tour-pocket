import { useCallback, useState } from 'react';
import {
  nextFontSize,
  readDisplaySettings,
  writeDisplaySettings,
  type DisplayMode,
  type DisplaySettings,
  type FontSize,
} from './display-settings';

export function useDisplaySettings() {
  const [settings, setSettings] = useState<DisplaySettings>(() => readDisplaySettings());

  const update = useCallback((patch: Partial<DisplaySettings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };
      writeDisplaySettings(next);
      return next;
    });
  }, []);

  const setMode = useCallback((mode: DisplayMode) => update({ mode }), [update]);
  const setFontSize = useCallback((fontSize: FontSize) => update({ fontSize }), [update]);
  const cycleFontSize = useCallback(() => {
    setSettings((previous) => {
      const next = { ...previous, fontSize: nextFontSize(previous.fontSize) };
      writeDisplaySettings(next);
      return next;
    });
  }, []);

  return { settings, setMode, setFontSize, cycleFontSize };
}
