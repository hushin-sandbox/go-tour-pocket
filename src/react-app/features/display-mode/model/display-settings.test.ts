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
    expect(DEFAULT_DISPLAY_SETTINGS).toEqual({ mode: 'bilingual', fontSize: 'medium' });
  });

  it('round-trips saved settings', () => {
    const storage = memoryStorage();
    writeDisplaySettings({ mode: 'ja', fontSize: 'large' }, storage);

    expect(readDisplaySettings(storage)).toEqual({ mode: 'ja', fontSize: 'large' });
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
