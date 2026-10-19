/**
 * オフライン利用のための設定。Service Worker の登録は vite-plugin-pwa の
 * injectRegister（index.html への registerSW.js 注入）に任せ、ここでは
 * ストレージの永続化だけを要求する。
 */

export async function requestPersistentStorage(): Promise<boolean> {
  const storage: StorageManager | undefined = navigator.storage;
  if (storage === undefined || typeof storage.persist !== 'function') return false;
  try {
    return await storage.persist();
  } catch {
    return false;
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  const storage: StorageManager | undefined = navigator.storage;
  if (storage === undefined || typeof storage.persisted !== 'function') return false;
  try {
    return await storage.persisted();
  } catch {
    return false;
  }
}
