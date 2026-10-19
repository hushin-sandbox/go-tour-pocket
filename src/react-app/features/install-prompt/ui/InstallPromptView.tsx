import { Download, Share } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/react-app/shared/ui';
import { resolveInstallPromptTarget, type InstallPromptContext } from '../model/install-prompt';

export type InstallPromptViewProps = {
  context: InstallPromptContext;
  /** Chromium: インストールダイアログを開く */
  onInstall?: () => void;
  /** iOS: 手順カードを閉じる */
  onDismiss?: () => void;
};

const regionProps = { role: 'region', 'aria-label': 'インストールの案内' } as const;

/**
 * インストール導線の見た目。表示するかどうかは context から純関数で決めるので、
 * ブラウザ API を持たない Storybook でも分岐をそのまま再現できる。
 */
export function InstallPromptView({ context, onInstall, onDismiss }: InstallPromptViewProps) {
  const target = resolveInstallPromptTarget(context);
  if (target === 'none') return null;

  if (target === 'chromium') {
    return (
      <Card {...regionProps}>
        <CardHeader>
          <CardTitle>ホーム画面に追加</CardTitle>
          <CardDescription>
            インストールすると、通信がない場所でもアプリのように開けます。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button className="h-11 px-4" onClick={onInstall}>
            <Download aria-hidden className="size-4" />
            インストール
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card {...regionProps}>
      <CardHeader>
        <CardTitle>ホーム画面に追加</CardTitle>
        <CardDescription>
          Safari の共有メニューから追加すると、通信がない場所でも開けるようになります。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="flex flex-col gap-2 text-sm leading-6">
          <li className="flex gap-2">
            <span aria-hidden className="font-mono text-muted-foreground">
              1.
            </span>
            <span>
              共有ボタン（
              <Share aria-hidden className="mx-0.5 inline size-3.5 align-[-2px]" />
              四角に上矢印）をタップする
            </span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="font-mono text-muted-foreground">
              2.
            </span>
            <span>「ホーム画面に追加」を選ぶ</span>
          </li>
          <li className="flex gap-2">
            <span aria-hidden className="font-mono text-muted-foreground">
              3.
            </span>
            <span>「追加」をタップする</span>
          </li>
        </ol>
        <p className="text-xs leading-5 text-muted-foreground">
          追加しておくと、Safari が 7 日でデータを消す対象から外れます。
        </p>
        <div className="flex justify-end">
          <Button variant="ghost" className="h-11 px-4" onClick={onDismiss}>
            閉じる
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
