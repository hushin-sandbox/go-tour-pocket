/**
 * CodeRunner が localStorage に保存するもの（編集中のコード・文字サイズ）。
 *
 * DOM に依存しないので Workers runtime のテストからも使える。localStorage は
 * プライベートモードや容量超過で例外を投げることがあるため、読み書きはすべて
 * try/catch で包み、保存できなくても編集そのものは続けられるようにする。
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CodeDraft {
  codeHash: string;
  code: string;
}

export type CodeFontSize = 'sm' | 'md' | 'lg';

export const DEFAULT_CODE_FONT_SIZE: CodeFontSize = 'md';

export const CODE_FONT_SIZE_OPTIONS: readonly { value: CodeFontSize; label: string }[] = [
  { value: 'sm', label: '小' },
  { value: 'md', label: '中' },
  { value: 'lg', label: '大' },
];

const DRAFT_KEY_PREFIX = 'go-tour-pocket:draft:';
const FONT_SIZE_KEY = 'go-tour-pocket:code-font-size';

export function draftStorageKey(storageKey: string): string {
  return `${DRAFT_KEY_PREFIX}${storageKey}`;
}

/**
 * 保存済みの下書きを読む。原文の hash が変わっていれば古い下書きとして削除する。
 */
export function loadDraft(
  storage: KeyValueStorage,
  storageKey: string,
  codeHash: string,
): string | null {
  const key = draftStorageKey(storageKey);
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;

  const draft = parseDraft(raw);
  if (draft === null || draft.codeHash !== codeHash) {
    clearDraft(storage, storageKey);
    return null;
  }
  return draft.code;
}

export function saveDraft(storage: KeyValueStorage, storageKey: string, draft: CodeDraft): void {
  try {
    storage.setItem(draftStorageKey(storageKey), JSON.stringify(draft));
  } catch {
    // 容量超過などで保存できなくても編集は続けられる
  }
}

export function clearDraft(storage: KeyValueStorage, storageKey: string): void {
  try {
    storage.removeItem(draftStorageKey(storageKey));
  } catch {
    // 何もできることはない
  }
}

export function loadCodeFontSize(storage: KeyValueStorage | null): CodeFontSize {
  if (storage === null) return DEFAULT_CODE_FONT_SIZE;
  try {
    const value = storage.getItem(FONT_SIZE_KEY);
    return isCodeFontSize(value) ? value : DEFAULT_CODE_FONT_SIZE;
  } catch {
    return DEFAULT_CODE_FONT_SIZE;
  }
}

export function saveCodeFontSize(storage: KeyValueStorage | null, size: CodeFontSize): void {
  if (storage === null) return;
  try {
    storage.setItem(FONT_SIZE_KEY, size);
  } catch {
    // 保存できなくても文字サイズの変更自体は反映する
  }
}

function isCodeFontSize(value: unknown): value is CodeFontSize {
  return value === 'sm' || value === 'md' || value === 'lg';
}

function parseDraft(raw: string): CodeDraft | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object') return null;
  if (!('codeHash' in value) || typeof value.codeHash !== 'string') return null;
  if (!('code' in value) || typeof value.code !== 'string') return null;
  return { codeHash: value.codeHash, code: value.code };
}
