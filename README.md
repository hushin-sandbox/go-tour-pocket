# go-tour-pocket

A Tour of Go を英日対訳・オフラインで学べるスマホ向け PWA。

Tour の英語原文と日本語訳を段落ごとに対訳表示し、コード例はブラウザ内の Go インタプリタ
（Yaegi を wasm 化したもの）で実行する。iOS Safari（ホーム画面追加）と Android Chrome
（インストール済み PWA）の両方で、機内モードでも動くことを目標にしている。

設計の詳細は [`docs/design.md`](docs/design.md) を参照。

## Tech Stack

| カテゴリ       | 技術                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| フロントエンド | React 19, TypeScript, shadcn/ui（base UI）, Tailwind CSS v4                     |
| ルーティング   | TanStack Router（file-based routing）                                           |
| フォーム       | TanStack Form                                                                   |
| データ取得     | TanStack Query                                                                  |
| ビルドツール   | Vite 8, @tanstack/router-plugin                                                 |
| PWA            | vite-plugin-pwa（Workbox）, Web Worker, Go + Yaegi（wasm）                      |
| デプロイ       | Wrangler 4, Cloudflare Workers（静的アセット配信のみ。API は持たない）          |
| Lint / Format  | oxlint, oxfmt, steiger（FSD 構造）, dependency-cruiser（依存の向き）            |
| UI カタログ    | Storybook 10（@storybook/tanstack-react）                                       |
| テスト         | Vitest, @storybook/addon-vitest（browser mode / Playwright）, Playwright（e2e） |
| Git hooks      | lefthook                                                                        |
| パッケージ管理 | pnpm                                                                            |
| バージョン管理 | mise                                                                            |

## コード実行（スパイク）

`/spike` に、Yaegi を wasm 化した Go インタプリタを Web Worker で動かす検証ページがある。

- `wasm/` — Go モジュール。`mise run build:wasm` で `public/wasm/{yaegi.wasm,wasm_exec.js}` を生成（どちらも gitignore）
- `src/react-app/shared/lib/goRunner.ts` — main 側の API（`preloadGo` / `runGo` / `disposeGo`）。タイムアウト・停止は Worker を terminate して作り直す
- `src/react-app/shared/lib/goRunner.worker.ts` — Worker。stdout / stderr を逐次送り、`IMAGE:` 行を data URL に変換する
- `vite-plugin-pwa` が app shell・wasm・wasm_exec.js を precache する。起動時に `navigator.storage.persist()` を要求する

```bash
mise run build:wasm  # wasm だけ再ビルド（pnpm build / pnpm dev の前に自動実行される）
pnpm e2e:spike       # build 後、Playwright で /spike の実行・停止・オフラインを確認
```

詳細と制約は [`wasm/README.md`](wasm/README.md) を参照。

## コンテンツ生成

Tour の本文はビルド時に取得するのではなく、`content/` に生成物をコミットしている。
生成・検証は `scripts/content/` を Node（型ストリッピング）で直接実行する。

```bash
node scripts/content/fetch.ts     # golang/website の固定コミットから原文を .cache/ に取得
node scripts/content/build.ts     # content/en/<lesson>.json を生成
node scripts/content/validate.ts  # content/ja と突き合わせて検証（訳の欠落・hash のズレ）
```

## ライセンス表記

`/licenses` のデータはビルド時に `scripts/licenses/plugin.ts`（Vite プラグイン）が集める。
npm / Go / Workbox のライセンスと、本文・日本語訳・コード例の表記を `virtual:licenses` の
JS チャンクに埋め込み、Service Worker の precache に載せる。点検用に `dist/licenses.json` も
書き出す。追加のコマンドはなく、`pnpm build` の一部として動く。

## ディレクトリ構造

```
.
├── .storybook/            # Storybook 設定（main.ts / preview.tsx）
├── .agents/skills/        # skill（外部スキルは skills-lock.json から復元。.claude/skills はここへの symlink）
├── content/               # Tour 本文（en）と日本語訳（ja）。scripts/content が生成・検証する
├── scripts/               # content / licenses / e2e の Node スクリプト
├── src/
│   ├── react-app/         # React SPA（Feature-Sliced Design。構造は steiger が検査）
│   │   ├── main.tsx
│   │   ├── app/           # provider / router 初期化、layouts
│   │   ├── routes/        # TanStack Router file-based routes（薄い route 定義）
│   │   ├── pages/         # 画面本体（URL セグメント単位のスライス）
│   │   └── shared/        # ui（shadcn/ui）, lib（cn, Go runner）
│   └── shared/            # アプリとビルドスクリプトの共通コード（zod スキーマなど）
├── public/                # 静的アセット（wasm は build:wasm の生成物で gitignore）
├── wasm/                  # Go モジュール（Yaegi + 抽出済みシンボル）
├── dist/                  # ビルド出力（wrangler.json の assets.directory）
├── docs/                  # ドキュメント
├── wrangler.json          # Wrangler 設定（静的アセット配信）
├── vite.config.ts
├── vitest.config.ts       # unit / storybook / scripts の 3 プロジェクト構成
├── steiger.config.ts      # FSD の構造 lint
├── .dependency-cruiser.mjs # レイヤー間の import 方向の lint
├── tsconfig.*.json
└── mise.toml              # ツールバージョン管理（Node / pnpm / Go）
```

story（`*.stories.tsx`）とモックデータ（`*.mock.ts`）は対象ファイルの隣に置く。
`src/react-app/` のレイヤー構成の詳細は `.agents/skills/fsd/SKILL.md` を参照。

`src/shared` はアプリとビルドスクリプトの両方から読まれる土台で、`src/react-app` に依存しては
いけない。この向きは `.dependency-cruiser.mjs` に規約（理由は `comment`）として書かれており、
`pnpm lint` で検査される。概要は `AGENTS.md` の「依存の向き」を参照。

## よく使うコマンド

```bash
# 環境セットアップ
mise install          # Node, pnpm, Go などのバージョンを揃える
mise run setup        # pnpm install + 外部スキル復元 + Playwright + lefthook install

# 開発
pnpm dev              # 開発サーバー起動（localhost:5173）

# ビルド & デプロイ
mise run build:wasm   # Yaegi の wasm を public/wasm/ にビルド
pnpm build            # プロダクションビルド（prebuild で build:wasm が走る）
pnpm preview          # ビルドしたものをローカルプレビュー
pnpm run deploy       # Cloudflare Workers にデプロイ (run が必要)
pnpm check            # lint + 整形チェック + ビルド + dry-run

# Lint / Format
pnpm lint             # lint チェック（oxlint + steiger + dependency-cruiser）
pnpm lint:fix         # lint 自動修正
pnpm lint:deps        # レイヤーをまたぐ import の向きだけを検査
pnpm deps:graph       # 依存グラフを dot 形式で出力
pnpm fmt              # フォーマット
pnpm fmt:check        # フォーマットチェック

# テスト / Storybook
pnpm test             # vitest run（unit + storybook + scripts）
pnpm test:watch       # vitest watch
pnpm e2e              # build 済み dist で通し e2e（Playwright）
pnpm e2e:update       # Service Worker の自動更新だけを e2e
pnpm e2e:spike        # build + /spike のスモークテスト
pnpm storybook        # Storybook UI（localhost:6006）
pnpm build-storybook  # Storybook の静的ビルド
```

## テスト

`pnpm test` は vitest の 3 プロジェクトをまとめて実行する。

| プロジェクト | 対象                             | 実行環境                                     |
| ------------ | -------------------------------- | -------------------------------------------- |
| unit         | `src/**/*.test.ts`               | Node                                         |
| storybook    | `src/react-app/**/*.stories.tsx` | vitest browser mode（Playwright / chromium） |
| scripts      | `scripts/**/*.test.ts`           | Node                                         |

書き分けの方針:

- **UI（コンポーネント・ページ）** — 専用のテストファイルを作らず、**story の `play` 関数がそのまま
  interaction test** になる（[Storybook: Interaction testing](https://storybook.js.org/docs/writing-tests/interaction-testing)）。
- **util 関数・複雑な計算ロジック** — 対象の隣に `*.test.ts` を置いて直接テストする。
  `src/` 配下でも DOM が要るものは story にする（Node 環境で動く）
- **ビルドスクリプト** — `scripts/**/*.test.ts`。`scripts` プロジェクト（Node）で動く

書き方の指針は `.agents/skills/storybook-testing/SKILL.md` にまとめてある。
