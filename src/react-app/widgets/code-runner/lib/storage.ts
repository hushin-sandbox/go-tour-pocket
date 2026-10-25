/**
 * CodeRunner が localStorage に保存するもの（編集中のコード・折り返し）。
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

const DRAFT_KEY_PREFIX = 'go-tour-pocket:draft:';
const WRAP_KEY = 'go-tour-pocket:code-wrap';

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

/**
 * 保存済みの折り返し設定を読む。未保存・不正な値・storage なし・例外なら null
 * （呼び出し側が画面幅などから初期値を決める）。
 */
export function loadCodeWrap(storage: KeyValueStorage | null): boolean | null {
  if (storage === null) return null;
  try {
    const value = storage.getItem(WRAP_KEY);
    if (value === 'on') return true;
    if (value === 'off') return false;
    return null;
  } catch {
    return null;
  }
}

export function saveCodeWrap(storage: KeyValueStorage | null, wrap: boolean): void {
  if (storage === null) return;
  try {
    storage.setItem(WRAP_KEY, wrap ? 'on' : 'off');
  } catch {
    // 保存できなくても折り返しの変更自体は反映する
  }
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
