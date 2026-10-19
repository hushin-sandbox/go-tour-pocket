/**
 * レイヤー間の import 方向を機械的に守るための設定（`pnpm lint` に含まれる）。
 *
 * oxlint / steiger と役割が違う:
 * - oxlint … 1 ファイル内のコードの書き方
 * - steiger … `src/react-app` の FSD 構造（レイヤー・スライス・public API）
 * - ここ    … `src/shared` `src/react-app` をまたぐ依存の向き
 *
 * ルールを足すときは「なぜその向きが禁止なのか」を comment に書く。
 * 違反の意味が分からないルールは、いずれ回避されて意味を失う。
 */
export default {
  forbidden: [
    {
      name: 'no-circular',
      comment: '循環依存。片方を分割するか、共通部分を切り出して依存の向きを一方向にする。',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'shared-is-not-allowed-to-depend-on-react-app',
      comment:
        'src/shared は UI と react-app の両方から読まれる土台。react-app に依存すると ' +
        'レイヤーの向きが逆になる（`src/shared` は DTO と定数だけに保つ）。',
      severity: 'error',
      from: { path: '^src/shared' },
      to: { path: '^src/react-app' },
    },
  ],
  options: {
    // 依存の解決に path alias（@/*）が必要。paths を持つのはルートの tsconfig
    tsConfig: { fileName: 'tsconfig.json' },
    // `import type` も依存として数える（型だけの循環依存も検出する）
    tsPreCompilationDeps: true,
    // node_modules は「依存として数えるが中は辿らない」。includeOnly: '^src' にすると
    // npm への依存がグラフから落ち、「この層は特定のライブラリに依存しない」系のルールを
    // 足したときに素通りしてしまう
    doNotFollow: { path: 'node_modules' },
    // 自動生成物は対象外
    exclude: { path: 'routeTree\\.gen\\.ts$' },
  },
};
