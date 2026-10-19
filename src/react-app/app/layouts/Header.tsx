import { Link } from '@tanstack/react-router';
import { Info } from 'lucide-react';
import { NetworkStatus } from '@/react-app/features/network-status';

/**
 * スマホ向けのコンパクトなヘッダ。ノッチ・ホームインジケータを避けるため
 * safe-area を padding で確保する。各ページはこの下で自分のレイアウトを持つ。
 */
export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background pt-[env(safe-area-inset-top)]">
      <div className="flex h-12 items-center gap-2 pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]">
        <Link
          to="/"
          className="flex min-h-11 items-center rounded-md font-heading text-sm font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Go Tour Pocket
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <NetworkStatus />
          <Link
            to="/about"
            aria-label="このアプリについて"
            className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Info aria-hidden className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
