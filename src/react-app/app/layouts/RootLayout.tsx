import { Outlet } from '@tanstack/react-router';
import { AppUpdateNotice } from '@/react-app/features/app-update';
import { Header } from './Header';

/**
 * アプリの枠。余白は各ページが持つので、ここでは Header と Outlet を
 * 縦に並べるだけにして、ページ側のレイアウト（下部固定ナビなど）を邪魔しない。
 */
export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header />
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
      <AppUpdateNotice />
    </div>
  );
}
