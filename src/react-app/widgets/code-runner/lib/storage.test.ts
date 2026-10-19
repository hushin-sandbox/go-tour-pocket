import {
  DEFAULT_CODE_FONT_SIZE,
  clearDraft,
  draftStorageKey,
  loadCodeFontSize,
  loadDraft,
  saveCodeFontSize,
  saveDraft,
  type KeyValueStorage,
} from './storage';

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const throwingStorage: KeyValueStorage = {
  getItem() {
    throw new Error('storage unavailable');
  },
  setItem() {
    throw new Error('quota exceeded');
  },
  removeItem() {
    throw new Error('storage unavailable');
  },
};

describe('loadDraft', () => {
  it('同じ codeHash の下書きを返す', () => {
    const storage = new MemoryStorage();
    saveDraft(storage, 'basics/1', { codeHash: 'abc', code: 'package main' });

    expect(loadDraft(storage, 'basics/1', 'abc')).toBe('package main');
  });

  it('codeHash が違う下書きは削除して null を返す', () => {
    const storage = new MemoryStorage();
    saveDraft(storage, 'basics/1', { codeHash: 'old', code: 'package old' });

    expect(loadDraft(storage, 'basics/1', 'new')).toBeNull();
    expect(storage.getItem(draftStorageKey('basics/1'))).toBeNull();
  });

  it('壊れた JSON は削除して null を返す', () => {
    const storage = new MemoryStorage();
    storage.setItem(draftStorageKey('basics/1'), '{not json');

    expect(loadDraft(storage, 'basics/1', 'abc')).toBeNull();
    expect(storage.getItem(draftStorageKey('basics/1'))).toBeNull();
  });

  it('code や codeHash の型が違う下書きは無視する', () => {
    const storage = new MemoryStorage();
    storage.setItem(draftStorageKey('basics/1'), JSON.stringify({ codeHash: 'abc', code: 1 }));

    expect(loadDraft(storage, 'basics/1', 'abc')).toBeNull();
  });

  it('読み込みに失敗しても例外を投げない', () => {
    expect(loadDraft(throwingStorage, 'basics/1', 'abc')).toBeNull();
  });
});

describe('saveDraft / clearDraft', () => {
  it('storageKey ごとに別のキーへ保存する', () => {
    const storage = new MemoryStorage();
    saveDraft(storage, 'basics/1', { codeHash: 'a', code: 'one' });
    saveDraft(storage, 'basics/2', { codeHash: 'b', code: 'two' });

    expect(storage.getItem(draftStorageKey('basics/1'))).toBe('{"codeHash":"a","code":"one"}');
    expect(storage.getItem(draftStorageKey('basics/2'))).toBe('{"codeHash":"b","code":"two"}');
  });

  it('clearDraft でそのキーだけ消す', () => {
    const storage = new MemoryStorage();
    saveDraft(storage, 'basics/1', { codeHash: 'a', code: 'one' });
    saveDraft(storage, 'basics/2', { codeHash: 'b', code: 'two' });

    clearDraft(storage, 'basics/1');

    expect(storage.getItem(draftStorageKey('basics/1'))).toBeNull();
    expect(storage.getItem(draftStorageKey('basics/2'))).not.toBeNull();
  });

  it('書き込みに失敗しても例外を投げない', () => {
    expect(() =>
      saveDraft(throwingStorage, 'basics/1', { codeHash: 'a', code: 'one' }),
    ).not.toThrow();
    expect(() => clearDraft(throwingStorage, 'basics/1')).not.toThrow();
  });
});

describe('文字サイズ', () => {
  it('保存した値を返す', () => {
    const storage = new MemoryStorage();
    saveCodeFontSize(storage, 'lg');

    expect(loadCodeFontSize(storage)).toBe('lg');
  });

  it('未保存・不正な値は既定値にする', () => {
    const storage = new MemoryStorage();
    expect(loadCodeFontSize(storage)).toBe(DEFAULT_CODE_FONT_SIZE);

    storage.setItem('go-tour-pocket:code-font-size', 'huge');
    expect(loadCodeFontSize(storage)).toBe(DEFAULT_CODE_FONT_SIZE);
  });

  it('storage がなくても既定値で動く', () => {
    expect(loadCodeFontSize(null)).toBe(DEFAULT_CODE_FONT_SIZE);
    expect(() => saveCodeFontSize(null, 'sm')).not.toThrow();
  });

  it('読み書きに失敗しても例外を投げない', () => {
    expect(loadCodeFontSize(throwingStorage)).toBe(DEFAULT_CODE_FONT_SIZE);
    expect(() => saveCodeFontSize(throwingStorage, 'sm')).not.toThrow();
  });
});
