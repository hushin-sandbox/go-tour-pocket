import { Link } from '@tanstack/react-router';
import { ExternalLink } from 'lucide-react';

const knownDifferences = [
  {
    name: '時刻と runtime.GOOS',
    description:
      '実行環境の時刻は実時間です。go.dev のツアーでは 2009-11-10 23:00 UTC に固定されていて、runtime.GOOS は js になります。',
  },
  {
    name: '%T の型名',
    description: '%T が表示する型名は、go.dev の処理系（gc）と異なる場合があります。',
  },
  {
    name: '不正なコード',
    description:
      'return の欠落など、go.dev ではコンパイルエラーになるコードを受理する場合があります。',
  },
];

const linkRowClass =
  'flex min-h-11 items-center justify-between gap-3 text-sm text-foreground underline-offset-4 hover:text-link hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

export function AboutPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-4 pt-8 pb-[calc(env(safe-area-inset-bottom)_+_2rem)]">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          Go Tour Pocket について
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          A Tour of Go を英日対訳で読み、コード例をその場で動かせるスマホ向けのアプリです。
          一度開いたレッスンは端末に保存されるので、通信がない場所でも学習を続けられます。
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">できること</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>英語原文と日本語訳を、段落ごとに対にして読めます。</li>
          <li>ブラウザ内の Go インタプリタ（Yaegi）で、コード例を通信なしで実行できます。</li>
          <li>既読ページと編集したコードは端末に保存され、続きから再開できます。</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">実行結果についての既知の差異</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          このアプリの Go はブラウザ内で動く Yaegi（wasm）です。go.dev
          のツアーとは次の点が異なります。
        </p>
        <dl className="divide-y divide-border border-y border-border">
          {knownDifferences.map((item) => (
            <div key={item.name} className="flex flex-col gap-1 py-3">
              <dt className="text-sm font-medium">{item.name}</dt>
              <dd className="text-sm leading-6 text-muted-foreground">{item.description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold tracking-tight">インストール</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            ホーム画面に追加すると、通信がない場所でもアプリのように開けます。
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">iPhone / iPad（Safari）</h3>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm leading-6 text-muted-foreground">
            <li>共有ボタン（四角に上矢印）をタップする</li>
            <li>「ホーム画面に追加」を選ぶ</li>
            <li>「追加」をタップする</li>
          </ol>
          <p className="text-xs leading-5 text-muted-foreground">
            追加しておくと、Safari が 7 日でデータを消す対象から外れます。
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Android（Chrome）</h3>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm leading-6 text-muted-foreground">
            <li>右上のメニュー（縦三点）をタップする</li>
            <li>「アプリをインストール」または「ホーム画面に追加」を選ぶ</li>
          </ol>
          <p className="text-xs leading-5 text-muted-foreground">
            レッスン一覧にインストールの案内が出ているときは、そちらのボタンからも追加できます。
          </p>
        </div>
      </section>

      <nav aria-label="関連リンク" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">リンク</h2>
        <ul className="divide-y divide-border border-y border-border">
          <li>
            <a href="/licenses" className={linkRowClass}>
              <span>ライセンス</span>
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            </a>
          </li>
          <li>
            <Link to="/spike" className={linkRowClass}>
              <span>実行エンジンの診断</span>
              <span aria-hidden className="text-muted-foreground">
                →
              </span>
            </Link>
          </li>
          <li>
            <a
              href="https://go.dev/tour/"
              target="_blank"
              rel="noreferrer"
              className={linkRowClass}
            >
              <span className="flex flex-col gap-0.5">
                <span>A Tour of Go の原文</span>
                <span className="text-xs text-muted-foreground">https://go.dev/tour/</span>
              </span>
              <ExternalLink aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
