import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  readDisplaySettings,
  writeDisplaySettings,
  type DisplayMode,
  type DisplaySettings,
  type FontSize,
} from './display-settings';

type DisplaySettingsContextValue = {
  settings: DisplaySettings;
  setMode: (mode: DisplayMode) => void;
  setFontSize: (fontSize: FontSize) => void;
};

const DisplaySettingsContext = createContext<DisplaySettingsContextValue | null>(null);

/**
 * 表示設定は Header の「表示設定」メニュー（切り替え）とレッスン画面の本文
 * （読み取り）の両方から使うので、1 つの state を context で共有する。
 * アプリ全体は RootLayout で包む。
 */
export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo(
    () => ({ settings, setMode, setFontSize }),
    [settings, setMode, setFontSize],
  );

  return <DisplaySettingsContext value={value}>{children}</DisplaySettingsContext>;
}

export function useDisplaySettings(): DisplaySettingsContextValue {
  const value = useContext(DisplaySettingsContext);
  if (value === null) {
    throw new Error('useDisplaySettings は DisplaySettingsProvider の中で使う');
  }
  return value;
}
