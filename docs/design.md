# go-tour-pocket 設計

A Tour of Go を通勤中にスマホで学ぶための PWA。英日を段落ごとの対訳で表示し、
コード例はブラウザ内の Go インタプリタ（Yaegi を wasm 化）でオフライン実行する。

対象端末: iOS Safari（ホーム画面追加の PWA）と Android Chrome（インストール済み PWA）。
どちらでも同じ機能が動くことを完了条件にする。

## 全体構成

```
[ビルド時]
  golang/website@<pin> の _content/tour/*.article ─ scripts/content ─→ content/en/<lesson>.json
  翻訳（サブエージェント並列）                                    ─→ content/ja/<lesson>.json
  wasm/（Yaegi + 標準ライブラリの一部 + x/tour）     ─ GOOS=js GOARCH=wasm ─→ yaegi.wasm

[実行時: PWA]
  React SPA ─ レッスン表示（英日の段落対訳）/ エディタ（CodeMirror 6）/ 進捗・編集内容の保存
     │
     ├─ Service Worker: アプリ本体・content・yaegi.wasm・wasm_exec.js を事前キャッシュ
     └─ Web Worker: yaegi.wasm を読み込み、コードを解釈実行
```

Cloudflare Workers は静的アセットの配信と SPA フォールバックだけを担う（Wrangler の
`assets` のみで、Worker スクリプトを持たない）。API は持たない。

## コンテンツ

### 取得元

- 英語原文: `golang/website` の `_content/tour/`。コミットは `scripts/content` で固定する（初期値 `d1edce5`）
- 参照用の旧訳: `atotto/go-tour-jp` の `jp` ブランチ（`913c5ea`）。翻訳時の参考にするだけで、本文は新しく訳す
- ライセンス: 記事は CC BY 4.0、コードは BSD-3-Clause（The Go Authors）。アプリ内に帰属表示を置く

### 英語の生成物 `content/en/<lesson>.json`

`scripts/content` が `.article`（present 形式）を解析して生成し、コミットする。
レッスンは `welcome basics flowcontrol moretypes methods generics concurrency` の 7 つ。

```ts
type Lesson = {
  id: string; // "basics"
  title: string;
  description: string;
  pages: Page[]; // 0 始まり。URL は 1 始まり
};
type Page = {
  title: string;
  blocks: Block[];
  code?: { name: string; content: string }; // .play のファイル。OMIT 行を除去済み
};
type Block =
  | { id: string; hash: string; kind: 'p'; text: string } // 段落
  | { id: string; hash: string; kind: 'list'; items: string[] } // "- " で始まる箇条書き
  | { id: string; kind: 'pre'; text: string } // タブ字下げのコードブロック（訳さない）
  | { id: string; kind: 'image'; src: string }; // .image（訳さない）
```

- `id` は `<lesson>/<pageIndex>/<blockIndex>`。`hash` は原文テキストの SHA-1（先頭 12 桁）
- `text` / `items` は present のインライン記法のまま保持する（`` `code` ``、`_italic_`、`*bold*`、`[[url][label]]`）。
  HTML への変換はアプリ側の共通レンダラで行い、英日両方に同じものを使う
- `#appengine` 行はローカル版ツアーと同じく捨てる
- 1 ページの `.play` は最大 1 個（現行コンテンツで確認済み）。2 個以上あれば生成を失敗させる

### 日本語訳 `content/ja/<lesson>.json`

```ts
type LessonJa = {
  id: string;
  title: string;
  description: string;
  pages: {
    title: string;
    blocks: Record<string, { hash: string; text?: string; items?: string[] }>; // key は英語の block id
  }[];
};
```

- 訳すのは `kind: "p"` と `"list"` だけ。`hash` には訳したときの英語原文の `hash` を写す。
  原文を更新して `hash` が変わったら、その段落は「要再翻訳」として検出できる
- 段落を対応させる単位は block id。訳文で段落を分けたりまとめたりしない
- `scripts/content` の検証で次を検査する: 全 p/list に訳がある、`hash` が一致する、
  list の項目数が一致する、インラインコード（`` ` `` で囲んだ部分）と URL の集合が原文と一致する

### 翻訳の方針

- です・ます調。読者は Go 初学者のエンジニア
- Go の識別子、キーワード、コードは原文のまま。用語は Go 公式の慣例に従う
  （例: goroutine → ゴルーチン、channel → チャネル、slice → スライス、map → マップ、method → メソッド）
- 旧訳（go-tour-jp）は参照してよいが、原文と食い違う箇所は現行の原文に合わせる
- 訳はレッスン単位でサブエージェントに並列で割り当て、終わったら用語の統一を別の 1 本で見直す

## コード実行

### wasm（`wasm/`）

- Go モジュール。Yaegi は固定バージョンを使う。標準ライブラリのシンボルは Tour が使うものに絞る
  （fmt, math, math/cmplx, math/rand, strings, time, io, os, sync, image, image/color, errors, runtime, log など）
- `golang.org/x/tour` v0.1.0 の pic / wc / tree / reader をシンボルとして組み込む
- 実行の `runGo(source, emit)` に加えて、整形の `formatGo(source)` を公開する。
  `go/format.Source`（gofmt と同じ）で整形し、`{ ok, code?, error? }` を JSON 文字列で返す。
  Yaegi が go/parser を含むため、バイナリの増分は小さい（raw 約 +0.38MB、brotli 約 +0.06MB）
- 出力は `GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w"`。生成物はコミットせず、ビルド時に作る
- Go のバージョンは mise で固定する

### Web Worker との通信

```ts
// main → worker
{ type: "run"; runId: string; code: string }
{ type: "format"; reqId: string; code: string }
// worker → main
{ type: "ready" }
{ type: "stdout" | "stderr"; runId: string; data: string }
{ type: "image"; runId: string; dataUrl: string }   // pic の "IMAGE:" 行を変換したもの
{ type: "exit"; runId: string; ok: boolean; error?: string; ms: number }
{ type: "formatted"; reqId: string; ok: boolean; code?: string; error?: string }
```

- 1 回の実行ごとに出力を順に流す。`IMAGE:` は行単位でバッファしてから画像に変換する
- タイムアウト（既定 10 秒）か停止ボタンで `worker.terminate()` を呼び、Worker を作り直す
- 事前ビルド済みのパッケージ（x/tour）が書く os.Stdout は、同期的に回収する
  （PoC で Node.js の非同期 fs が deadlock することを確認済み）
- 整形は実行と同じ Worker で行う。Worker は実行中ブロックされるため、実行中の整形リクエストは
  処理されない。`formatGo` は実行中に `busy` を返し、UI 側もフォーマットボタンを無効にする
- 構文エラーのときは `code` を返さず、`error` に go/parser の `行:列: 内容` を入れる。
  UI はエディタを変えず、行番号付きのエラーを控えめなメッセージとして出す

### ショートカット（welcome レッスンの説明に合わせる）

- エディタにフォーカスがあるとき: `Shift` + `Enter` で実行、`Ctrl` + `Enter`（macOS は `Cmd` + `Enter`）でフォーマット
- エディタの外（レッスン画面の本文など）でも `Shift` + `Enter` で実行できる。
  入力欄・ボタン・リンク・ダイアログの上では働かせない
- 実行・フォーマットのボタンには `aria-keyshortcuts` と title でショートカットを表示する

### 既知の差異（UI で注記する）

- 時刻は実時間（go.dev は 2009-11-10 23:00 UTC 固定）。`runtime.GOOS` は `js`
- `%T` の型名が gc と異なる場合がある。不正なコード（return の欠落など）を受理する場合がある

## オフライン

- Service Worker は vite-plugin-pwa（Workbox）で生成する。アプリ本体・content・wasm を precache する。
  wasm が大きいので `maximumFileSizeToCacheInBytes` を引き上げる
- 起動時に `navigator.storage.persist()` を要求する
- インストールの導線:
  - Android Chrome: `beforeinstallprompt` で「インストール」ボタンを出す
  - iOS Safari: 共有メニューから「ホーム画面に追加」する手順を案内する（追加しないと 7 日で消える）
- 更新は `registerType: 'autoUpdate'`。新しい Service Worker は install 後すぐ
  skipWaiting + clientsClaim で有効になり、ページは制御が切り替わったら自動でリロードする。
  prompt 方式だと、更新 UI を持たない旧版のページは waiting のまま止まり、
  新しい index.html に到達できないことがある。編集中のコードは端末に保存しているので、
  自動リロードで失うものは小さい
- 更新確認はタブが表示されたときと 1 時間ごとに `registration.update()` を呼ぶ
  （オフライン時は呼ばない）

## 実機での確認結果（2026-10-19、スパイク）

- iOS Safari・Android Chrome とも、ホーム画面から機内モードで起動し、select・画像・無限ループの停止まで動いた
- hello world で wasm ロード 171ms、初回実行 140ms
- `storage.persisted()` は Android のみ true。iOS はホーム画面追加で 7 日の削除対象から外れるので、ホーム画面追加の案内で代える
- `yaegi.wasm` は raw 13MB、配信時は brotli（`content-encoding: br`）

## 画面

スマホの縦画面を基準に作る。片手で読み進められること、通勤中の短い時間で中断・再開できることを優先する。

### ルート

| パス                  | 画面                                                                           |
| --------------------- | ------------------------------------------------------------------------------ |
| `/`                   | レッスン一覧。モジュールごとにレッスンとページを並べ、既読と「続きから」を出す |
| `/tour/:lesson/:page` | ページ（`:page` は 1 始まり）                                                  |
| `/about`              | アプリの説明、既知の差異、インストール手順、`/licenses` へのリンク             |
| `/licenses`           | ライセンス表記（「ライセンス」節を参照）                                       |
| `/spike`              | 実行エンジンの診断ページ（残す。リンクは `/about` からだけ）                   |

### ページ画面

- 上部: レッスン名、ページ番号 / 総数、目次（シートで開く）、表示モードの切替
- 本文: block を順に描画する
  - p / list は英語と日本語を対にして並べる。表示モードは「対訳」「英語のみ」「日本語のみ」。対訳では英語を先、日本語を後に置き、日本語は色や罫線で区別する
  - 「英語のみ」のとき、段落をタップするとその段落の訳だけ開ける
  - pre と image は 1 回だけ描画する
  - インライン記法は `src/shared/inline.ts` のパーサで描画する。英日とも同じものを使う
- コード（`code` があるページ）: 本文の下に置く
  - エディタは CodeMirror 6（Go のシンタックスハイライト、行番号、文字サイズの調整）
  - 実行・フォーマット・停止・元に戻すのボタン。実行結果（stdout、stderr、画像、終了状態、所要時間）をエディタの下に出す
  - 既知の差異（時刻、`runtime.GOOS`、`%T`、不正なコードを受理する場合がある）を、折りたたんだ注記で出す
- 下部: 前へ・次へを親指で押せる位置に固定する。レッスンの最後のページでは次のレッスンへ進む

### 保存するもの（端末内の localStorage）

- 表示モード、文字サイズ
- 既読ページ、最後に開いたページ
- ページごとの編集中コード（キーは lesson/page と原文コードの hash。原文が変わったら破棄）

### PWA の導線

- オフライン中はヘッダに小さく表示する
- Android: `beforeinstallprompt` を受けたらレッスン一覧にインストールボタンを出す
- iOS Safari（standalone でないとき）: ホーム画面への追加手順をレッスン一覧に出す。閉じたら出さない
- 更新: `registerType: 'autoUpdate'` で、新版はユーザーの操作なしに切り替わる。
  旧版のページが waiting に残らないようにする理由は「オフライン」節を参照

## ライセンス

Web に公開するので、配布物に含まれるものすべてのライセンスを `/licenses` で読めるようにする。
オフラインでも開けるよう、表示内容はビルド時に JSON に生成して precache する。

### 表示するもの

| 対象                                                                       | ライセンス                                      | 表記                                                                                                                                  |
| -------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| A Tour of Go の本文（英語原文）                                            | CC BY 4.0                                       | 著作者（The Go Authors）、原文の URL と固定コミット、ライセンスへのリンク、改変の内容（段落への分割、日本語訳の追加、表示形式の変更） |
| 日本語訳                                                                   | CC BY 4.0（原文の翻案として同じ条件で公開する） | 本アプリで作成した訳であること。参考にした旧訳 go-tour-jp（BSD-3-Clause）へのクレジット                                               |
| A Tour of Go のコード例、`golang.org/x/tour`                               | BSD-3-Clause                                    | 全文と Go の PATENTS                                                                                                                  |
| Go のランタイムと標準ライブラリ（`yaegi.wasm` に含まれる）、`wasm_exec.js` | BSD-3-Clause                                    | 全文と PATENTS                                                                                                                        |
| Yaegi                                                                      | Apache-2.0                                      | 全文。NOTICE ファイルがあれば併記                                                                                                     |
| フロントエンドに同梱される npm パッケージ                                  | 各ライセンス（MIT など）                        | パッケージ名、バージョン、ライセンス名、全文                                                                                          |

### 生成の仕方

- npm: 実際にバンドルされたモジュールだけを対象にする（Vite のビルドから収集する。`node_modules` 全体を並べない）。devDependencies は含めない
- Go: `wasm/` のビルドに使われたモジュール（`go list -deps` などで確認）の LICENSE / NOTICE を集め、Go 本体の LICENSE と PATENTS を加える
- 生成物は `dist` に出し、Service Worker の precache に含める
- 新しい依存を足してライセンスが不明なときは、ビルドを失敗させる

### 画面

- 上に要約の表（対象、ライセンス、著作者、リンク）、その下にライセンス全文を折りたたみで並べる
  （スマホ幅では著作者とリンクを 1 列にまとめ、リンクは 44px のタップ領域にする）
- レッスン一覧の下部、`/about`、各ページの目次シートから `/licenses` へリンクする

## 進め方

1. テンプレートの整理と、実行エンジンのスパイク（wasm + Web Worker + Service Worker の最小ページ）。実機で確認する（済）
2. コンテンツパイプライン（`scripts/content`、`content/en`）（済）
3. 翻訳（`content/ja`）。レッスン単位で並列に進め、最後に用語を統一する（済）
4. 本体 UI（レッスン一覧、対訳表示、エディタ、実行結果、進捗）
5. PWA の仕上げ（インストール導線、更新通知）とライセンス表記ページ（`/licenses`）
