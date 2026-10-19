import type { CSSProperties } from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { AppUpdateNotice } from '@/react-app/features/app-update';
import { Header } from './Header';

/** 下部固定ナビ（前へ・次へ）の高さぶん、更新トーストを上に逃がす。 */
const TOAST_OFFSET_ABOVE_BOTTOM_NAV = 'calc(env(safe-area-inset-bottom) + 6rem)';

type ToastOffsetStyle = CSSProperties & { '--toast-bottom-offset': string };

/**
 * アプリの枠。余白は各ページが持つので、ここでは Header と Outlet を
 * 縦に並べるだけにして、ページ側のレイアウト（下部固定ナビなど）を邪魔しない。
 */
export function RootLayout() {
  const hasBottomNav = useRouterState({
    select: (state) => state.location.pathname.startsWith('/tour/'),
  });
  const style: ToastOffsetStyle | undefined = hasBottomNav
    ? { '--toast-bottom-offset': TOAST_OFFSET_ABOVE_BOTTOM_NAV }
    : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-background" style={style}>
      <Header />
      <main className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>
      <AppUpdateNotice />
    </div>
  );
}
