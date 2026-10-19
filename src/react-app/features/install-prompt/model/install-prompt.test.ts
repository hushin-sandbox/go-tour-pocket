import {
  IOS_INSTALL_GUIDE_STORAGE_KEY,
  dismissIosInstallGuide,
  isIosDevice,
  isIosInstallGuideDismissed,
  resolveInstallPromptTarget,
  type InstallPromptContext,
  type KeyValueStorage,
} from './install-prompt';

const IPHONE_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

const baseContext: InstallPromptContext = {
  hasInstallEvent: false,
  userAgent: ANDROID_CHROME_UA,
  maxTouchPoints: 5,
  standalone: false,
  dismissed: false,
};

function createStorage(initial?: Record<string, string>): KeyValueStorage & {
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('isIosDevice', () => {
  it('iPhone / iPad / iPod の UA を iOS と判定する', () => {
    expect(isIosDevice(IPHONE_SAFARI_UA)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15')).toBe(
      true,
    );
    expect(isIosDevice('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)')).toBe(true);
  });

  it('iPadOS 13 以降の Macintosh UA はタッチ対応なら iPad と判定する', () => {
    expect(isIosDevice(IPAD_DESKTOP_UA, 5)).toBe(true);
    expect(isIosDevice(IPAD_DESKTOP_UA, 0)).toBe(false);
  });

  it('Android / デスクトップは iOS ではない', () => {
    expect(isIosDevice(ANDROID_CHROME_UA, 5)).toBe(false);
    expect(
      isIosDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
      ),
    ).toBe(false);
  });
});

describe('resolveInstallPromptTarget', () => {
  it('beforeinstallprompt を捕捉できたら Chromium 向けのボタンを出す', () => {
    expect(
      resolveInstallPromptTarget({
        ...baseContext,
        hasInstallEvent: true,
        userAgent: IPHONE_SAFARI_UA,
      }),
    ).toBe('chromium');
  });

  it('インストールイベントが無い Android では何も出さない', () => {
    expect(resolveInstallPromptTarget(baseContext)).toBe('none');
  });

  it('standalone で起動中は何も出さない', () => {
    expect(
      resolveInstallPromptTarget({ ...baseContext, hasInstallEvent: true, standalone: true }),
    ).toBe('none');
    expect(
      resolveInstallPromptTarget({
        ...baseContext,
        userAgent: IPHONE_SAFARI_UA,
        standalone: true,
      }),
    ).toBe('none');
  });

  it('iOS Safari では手順カードを出す', () => {
    expect(resolveInstallPromptTarget({ ...baseContext, userAgent: IPHONE_SAFARI_UA })).toBe('ios');
  });

  it('iOS の手順カードを閉じたあとは出さない', () => {
    expect(
      resolveInstallPromptTarget({ ...baseContext, userAgent: IPHONE_SAFARI_UA, dismissed: true }),
    ).toBe('none');
  });

  it('閉じた記録があっても、インストールイベントがあればボタンは出す', () => {
    expect(
      resolveInstallPromptTarget({
        ...baseContext,
        userAgent: IPHONE_SAFARI_UA,
        hasInstallEvent: true,
        dismissed: true,
      }),
    ).toBe('chromium');
  });
});

describe('iOS 手順カードの閉じた記録', () => {
  it('記録が無ければ表示する', () => {
    expect(isIosInstallGuideDismissed(createStorage())).toBe(false);
  });

  it('閉じたら保存して、次回は表示しない', () => {
    const storage = createStorage();
    dismissIosInstallGuide(storage);
    expect(storage.values.get(IOS_INSTALL_GUIDE_STORAGE_KEY)).toBe('1');
    expect(isIosInstallGuideDismissed(storage)).toBe(true);
  });

  it('localStorage が使えなくても例外を投げない', () => {
    const brokenStorage: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(isIosInstallGuideDismissed(brokenStorage)).toBe(false);
    expect(() => dismissIosInstallGuide(brokenStorage)).not.toThrow();
    expect(() => dismissIosInstallGuide(undefined)).not.toThrow();
  });
});
