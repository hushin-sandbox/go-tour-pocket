const features = [
  {
    name: '英日対訳',
    description: 'A Tour of Go の英語原文と日本語訳を、段落ごとに対にして読めます。',
  },
  {
    name: 'オフライン実行',
    description: 'ブラウザ内の Go インタプリタでコード例を動かします。通信は不要です。',
  },
  {
    name: 'スマホ向け PWA',
    description: 'iOS Safari と Android Chrome のホーム画面から、通勤中にそのまま開けます。',
  },
];

export function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">Go Tour Pocket</h1>
        <p className="text-sm leading-6 text-muted-foreground break-keep">
          A Tour of Go を英日対訳・オフラインで学べるスマホ向け PWA
          です。通勤中に、通信の届かない場所でも、 Tour のコードをその場で動かしながら読めます。
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium">できること</h2>
        <dl className="divide-y divide-border border-t border-border">
          {features.map((item) => (
            <div
              key={item.name}
              className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
            >
              <dt className="text-sm font-medium">{item.name}</dt>
              <dd className="text-sm leading-6 text-muted-foreground sm:max-w-[65%] sm:text-right">
                {item.description}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-card px-5 py-4 text-sm leading-6 text-muted-foreground shadow-sm">
        レッスン一覧・対訳表示・コード実行はこれから実装します。実行エンジンの検証状況は
        <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">docs/design.md</code>
        を参照してください。
      </section>
    </div>
  );
}
