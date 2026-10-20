# go-tour-pocket

A Tour of Go を英日対訳・オフラインで学べるスマホ向け PWA。

Cloudflare Workers（静的アセット配信）/ React 19 + Vite 8 / TanStack Router・Form・Query /
shadcn/ui（base UI）+ Tailwind v4 / zod / Vitest + Storybook 10 / oxlint + oxfmt

設計の詳細は `docs/design.md` を参照する。

## 作業のルール

- パッケージマネージャは pnpm（mise で Node 24 / pnpm 12 / Go 1.25 を固定）
- 変更が一区切りしたら `pnpm check` と `pnpm test` を通す。型チェックは oxlint が兼ねるので `pnpm check` で型エラーまで見える
- コミットメッセージは Conventional Commits
- 整形は oxfmt、lint の自動修正は `pnpm lint:fix` が行う（pre-commit の lefthook も同じものを走らせる）

## コマンド

```bash
pnpm check       # 検証: lint（型チェック込み）+ fmt:check + build + deploy --dry-run
pnpm test        # 検証: vitest run（unit + storybook + scripts）
pnpm e2e         # 検証: build 済み dist で通し e2e（Playwright）
pnpm e2e:spike   # 検証: /spike を Playwright でスモークテスト（要 build）
pnpm lint        # lint だけ（oxlint + steiger + dependency-cruiser）
pnpm fmt         # 整形（oxfmt）。lint の自動修正は pnpm lint:fix
pnpm dev         # 開発サーバー（localhost:5173）
pnpm storybook   # Storybook（localhost:6006）
mise run build:wasm  # Yaegi wasm を public/wasm/ にビルド（pnpm build の prebuild でも走る）
node scripts/content/fetch.ts     # Tour 原文を golang/website から取得（初回・更新時）
node scripts/content/build.ts     # content/en を生成
node scripts/content/validate.ts  # content/ja と content/variants を突き合わせて検証
```

ライセンス一覧は `pnpm build` 時に `scripts/licenses/plugin.ts` が生成する（`virtual:licenses`
への埋め込みと `dist/licenses.json` の書き出し）。ライセンス生成専用のコマンドはない。

## 構造

```
src/
├── react-app/         # React SPA（Feature-Sliced Design。構造は steiger が検査）
│   ├── app/           # provider / router の初期化、layouts
│   ├── routes/        # TanStack Router の file-based route（薄い定義だけ）
│   ├── pages/         # 画面本体（URL セグメント単位のスライス）
│   └── shared/        # ui（shadcn/ui）/ lib（Go runner 含む）
└── shared/            # アプリとビルドスクリプトの共通コード（zod スキーマなど）
content/               # Tour 本文（en）・日本語訳（ja）・コードパターン（variants）。scripts/content が生成・検証する
scripts/               # content / licenses / e2e の Node スクリプト
wasm/                  # ブラウザ内 Go インタプリタ（Yaegi）。main.go と抽出済みシンボル
public/wasm/           # build:wasm の生成物（gitignore）。wasm_exec.js もここにコピーされる
```

- 新規ページ → `src/react-app/pages/<name>/ui/` に本体を書いて `src/react-app/routes/` に薄い route 定義を足す（詳細は `fsd` skill）
- `src/shared/` と `src/react-app/shared/` は別物。前者はアプリとビルドスクリプトが共有するスキーマ・型、後者は FSD の shared レイヤー

## 依存の向き

依存の向きは `.dependency-cruiser.mjs` が規約を持ち、`pnpm lint` が検査する。

- `src/shared` はアプリとビルドスクリプトの両方から読まれる土台なので、DTO と定数だけに保つ
- `src/shared` から `src/react-app` を参照しない（土台が UI に依存してはいけない）
- FSD のレイヤーをまたぐ import の向きは steiger が検査する

## テスト

- UI（描画・操作・状態分岐）は `*.stories.tsx` の `play` で書く。UI のために `render()` する専用テストは作らない
- DOM に触らないロジックは対象の隣に `*.test.ts` を置く（Node 環境。詳細は `testing` / `storybook-testing` skill）
- ビルドスクリプトは `scripts/**/*.test.ts`（`scripts` プロジェクト、Node 環境）
- wasm / Service Worker の実機相当の確認は `pnpm e2e` / `pnpm e2e:spike`（`scripts/e2e-*.mjs`）。vitest とは別系統

## ハマりどころ

- `routeTree.gen.ts` は自動生成だがコミット対象。手で編集しない
- Go の実行は Dedicated Worker（`src/react-app/shared/lib/goRunner.worker.ts`）。無限ループは Yaegi 側で止められないため、タイムアウト・停止は `worker.terminate()` で行い Worker を作り直す
- deadlock などで wasm の Go ランタイム自体が終了することがある。`go.exited` を検出して `fatal: true` 付きの exit を送り、main 側で Worker を作り直す（`fatal` が無い通常のエラーと混同しない）
- wasm は約 13MB あり Service Worker の precache 対象。`maximumFileSizeToCacheInBytes` を超えるファイルを増やすときは `vite.config.ts` も見る
- `wasm_exec.js` は Go のバージョンと一致必須。`mise run build:wasm` が `go env GOROOT` からコピーする
- 本番は Cloudflare Workers Builds が `pnpm run build` でビルドする。ビルド環境に mise は無いので、`build:wasm` は mise を経由せず `wasm/build.sh` を直接呼ぶ。ビルド環境の Go は古い（1.24 系）が、`wasm/go.mod` の `toolchain` 行を見て Go が指定の版を自動で取得する。Go を上げるときは `mise.toml` と `toolchain` 行を両方更新する
- ビルド出力は `dist`（`wrangler.json` の `assets.directory`）。`vitest` / Storybook は `vite.config.ts` を取り込むので、プラグインを足すときは両方で壊れないか確認する

## 外部スキル

外部リポジトリ由来の skill（`cloudflare`, `wrangler`, `hono` など）は `skills-lock.json` に固定し、実体は `.agents/skills/` に復元する（`mise run setup` に含まれる）。

- 追加 / 削除 / 更新 → `pnpm skills add <owner>/<repo> --skill <name> -a pi -y` / `pnpm skills remove <name> -y` / `pnpm skills update -p`
- リポジトリが保守する skill を足したら、`.gitignore` の許可リストに `!/.agents/skills/<name>/` も足す

## 参照

- 設計方針（コンテンツ、コード実行、オフライン）→ `docs/design.md`
- 翻訳の用語・文体 → `docs/translation-guide.md`
- wasm のビルド・シンボル再生成・既知の制約 → `wasm/README.md`
- skill（`fsd` / `testing` / `storybook-testing` / `shadcn-ui` / `cloudflare` など）は description を見て、必要になったら読む
