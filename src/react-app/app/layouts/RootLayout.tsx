import { Outlet } from '@tanstack/react-router';
import { DisplaySettingsProvider } from '@/react-app/features/display-mode';
import { AppUpdateNotice } from '@/react-app/features/app-update';
import { Header } from './Header';

/**
 * アプリの枠。余白は各ページが持つので、ここでは Header と Outlet を
 * 縦に並べるだけにして、ページ側のレイアウトを邪魔しない。
 *
 * 固定するのは Header だけ。表示設定は Header のメニューとレッスン本文の
 * 両方から読むので、ここで context を配る。
 */
export function RootLayout() {
  return (
    <DisplaySettingsProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <Header />
        <main className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
        <AppUpdateNotice />
      </div>
    </DisplaySettingsProvider>
  );
}
