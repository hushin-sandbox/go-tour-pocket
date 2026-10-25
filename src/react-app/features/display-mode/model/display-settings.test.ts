import {
  DEFAULT_DISPLAY_SETTINGS,
  DISPLAY_SETTINGS_STORAGE_KEY,
  nextFontSize,
  parseDisplaySettings,
  readDisplaySettings,
  writeDisplaySettings,
  type SettingsStorage,
} from './display-settings';

function memoryStorage(initial: string | null = null): SettingsStorage & { value: string | null } {
  return {
    value: initial,
    getItem(key) {
      return key === DISPLAY_SETTINGS_STORAGE_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === DISPLAY_SETTINGS_STORAGE_KEY) this.value = value;
    },
  };
}

describe('display settings', () => {
  it('uses the defaults when nothing is saved', () => {
    expect(readDisplaySettings(memoryStorage())).toEqual(DEFAULT_DISPLAY_SETTINGS);
    expect(DEFAULT_DISPLAY_SETTINGS).toEqual({
      mode: 'bilingual',
      fontSize: 'medium',
      codeFontSize: 'medium',
    });
  });

  it('round-trips saved settings', () => {
    const storage = memoryStorage();
    writeDisplaySettings({ mode: 'ja', fontSize: 'large', codeFontSize: 'small' }, storage);

    expect(readDisplaySettings(storage)).toEqual({
      mode: 'ja',
      fontSize: 'large',
      codeFontSize: 'small',
    });
  });

  it('コードの文字サイズが無い保存データは既定値で補う', () => {
    expect(parseDisplaySettings('{"mode":"en","fontSize":"large"}')).toEqual({
      mode: 'en',
      fontSize: 'large',
      codeFontSize: 'medium',
    });
  });

  it('以前 CodeRunner が保存したコードの文字サイズを引き継ぐ', () => {
    const values = new Map<string, string>([
      [DISPLAY_SETTINGS_STORAGE_KEY, '{"mode":"ja","fontSize":"large"}'],
      ['go-tour-pocket:code-font-size', 'lg'],
    ]);
    const storage: SettingsStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    };

    expect(readDisplaySettings(storage)).toEqual({
      mode: 'ja',
      fontSize: 'large',
      codeFontSize: 'large',
    });
    // 次回からは表示設定だけで完結するよう、移行後の値も書き戻す
    expect(JSON.parse(values.get(DISPLAY_SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      codeFontSize: 'large',
    });
  });

  it('falls back to the defaults for broken data', () => {
    expect(parseDisplaySettings('{')).toEqual(DEFAULT_DISPLAY_SETTINGS);
    expect(parseDisplaySettings('{"mode":"sideways"}')).toEqual(DEFAULT_DISPLAY_SETTINGS);
    expect(parseDisplaySettings(null)).toEqual(DEFAULT_DISPLAY_SETTINGS);
  });

  it('cycles font size in order', () => {
    expect(nextFontSize('small')).toBe('medium');
    expect(nextFontSize('medium')).toBe('large');
    expect(nextFontSize('large')).toBe('small');
  });
});
