import { z } from 'zod';

export const DISPLAY_SETTINGS_STORAGE_KEY = 'gotour:display:v1';

/**
 * コードの文字サイズを CodeRunner が単独で保存していた頃のキー。
 * 表示設定へ移したので、保存済みの値は初回の読み込みで引き継ぐ。
 */
const LEGACY_CODE_FONT_SIZE_KEY = 'go-tour-pocket:code-font-size';

export const DISPLAY_MODES = ['bilingual', 'en', 'ja'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const FONT_SIZES = ['small', 'medium', 'large'] as const;
export type FontSize = (typeof FONT_SIZES)[number];

export type DisplaySettings = {
  mode: DisplayMode;
  /** レッスン本文の文字サイズ */
  fontSize: FontSize;
  /** コードエディタの文字サイズ。本文とは独立して選べる */
  codeFontSize: FontSize;
};

export type SettingsStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  mode: 'bilingual',
  fontSize: 'medium',
  codeFontSize: 'medium',
};

export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  bilingual: '対訳',
  en: '英語のみ',
  ja: '日本語のみ',
};

export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  small: '小',
  medium: '中',
  large: '大',
};

/** 本文のフォントサイズ。small でも 16px を下回らない（可読性優先）。 */
export const FONT_SIZE_PX: Record<FontSize, string> = {
  small: '1rem',
  medium: '1.125rem',
  large: '1.25rem',
};

const settingsSchema = z.object({
  mode: z.enum(DISPLAY_MODES),
  fontSize: z.enum(FONT_SIZES),
  // コードの文字サイズを足す前に保存されたデータには無いので、既定値で補う
  codeFontSize: z.enum(FONT_SIZES).default(DEFAULT_DISPLAY_SETTINGS.codeFontSize),
});

export function parseDisplaySettings(raw: string | null): DisplaySettings {
  if (raw === null) return DEFAULT_DISPLAY_SETTINGS;
  try {
    const value: unknown = JSON.parse(raw);
    const parsed = settingsSchema.safeParse(value);
    return parsed.success ? parsed.data : DEFAULT_DISPLAY_SETTINGS;
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

// Worker / テスト環境には localStorage が無い。DOM 型に依存せず、実行時に有無を見る。
declare const localStorage: SettingsStorage | undefined;

function defaultStorage(): SettingsStorage | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

export function readDisplaySettings(storage?: SettingsStorage): DisplaySettings {
  const target = storage ?? defaultStorage();
  if (target === undefined) return DEFAULT_DISPLAY_SETTINGS;
  try {
    const raw = target.getItem(DISPLAY_SETTINGS_STORAGE_KEY);
    const settings = parseDisplaySettings(raw);
    if (hasStoredCodeFontSize(raw)) return settings;

    // コードの文字サイズを表示設定に持たせる前に保存していた値を引き継ぐ
    const legacyCodeFontSize = readLegacyCodeFontSize(target);
    if (legacyCodeFontSize === null) return settings;

    const migrated = { ...settings, codeFontSize: legacyCodeFontSize };
    writeDisplaySettings(migrated, target);
    return migrated;
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

function hasStoredCodeFontSize(raw: string | null): boolean {
  if (raw === null) return false;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null && 'codeFontSize' in value;
  } catch {
    return false;
  }
}

function readLegacyCodeFontSize(storage: SettingsStorage): FontSize | null {
  try {
    const value = storage.getItem(LEGACY_CODE_FONT_SIZE_KEY);
    if (value === 'sm') return 'small';
    if (value === 'md') return 'medium';
    if (value === 'lg') return 'large';
    return null;
  } catch {
    return null;
  }
}

export function writeDisplaySettings(settings: DisplaySettings, storage?: SettingsStorage): void {
  const target = storage ?? defaultStorage();
  if (target === undefined) return;
  try {
    target.setItem(DISPLAY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくても表示は続ける
  }
}

/** 文字サイズボタンは 小 → 中 → 大 → 小 の順に循環する。 */
export function nextFontSize(fontSize: FontSize): FontSize {
  const index = FONT_SIZES.indexOf(fontSize);
  return FONT_SIZES[(index + 1) % FONT_SIZES.length];
}
