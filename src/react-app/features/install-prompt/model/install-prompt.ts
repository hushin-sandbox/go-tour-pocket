/**
 * インストール導線の表示条件を決める純関数。
 *
 * Android / Chromium は beforeinstallprompt を捕捉できたときだけ「インストール」
 * ボタンを出せる（イベントが来ない = すでにインストール済みか、対象外のブラウザ）。
 * iOS Safari はイベントが無いので、UA と standalone かどうかで手順カードを出す。
 */

export type InstallPromptTarget = 'chromium' | 'ios' | 'none';

export type InstallPromptContext = {
  /** beforeinstallprompt を捕捉できているか */
  hasInstallEvent: boolean;
  userAgent: string;
  maxTouchPoints: number;
  /** ホーム画面から起動している（display-mode: standalone / navigator.standalone） */
  standalone: boolean;
  /** iOS の手順カードを閉じたことがあるか */
  dismissed: boolean;
};

export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const IOS_INSTALL_GUIDE_STORAGE_KEY = 'go-tour-pocket:ios-install-guide-dismissed';

/**
 * iOS 系の端末か。iPadOS 13 以降は UA が Macintosh になるため、
 * タッチ対応（maxTouchPoints > 1）も見て iPad を判定する。
 */
export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

export function resolveInstallPromptTarget(context: InstallPromptContext): InstallPromptTarget {
  if (context.standalone) return 'none';
  // インストールイベントがあるなら、iOS 以外も含めてブラウザ標準の導線に任せる
  if (context.hasInstallEvent) return 'chromium';
  if (isIosDevice(context.userAgent, context.maxTouchPoints) && !context.dismissed) return 'ios';
  return 'none';
}

/** localStorage が壊れていても（プライベートモードなど）落とさない。 */
export function isIosInstallGuideDismissed(storage: KeyValueStorage | null | undefined): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(IOS_INSTALL_GUIDE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** 閉じたことを記録する。保存できない環境では次回も案内を出す。 */
export function dismissIosInstallGuide(storage: KeyValueStorage | null | undefined): void {
  if (!storage) return;
  try {
    storage.setItem(IOS_INSTALL_GUIDE_STORAGE_KEY, '1');
  } catch {
    // 保存できない場合は何もしない
  }
}
