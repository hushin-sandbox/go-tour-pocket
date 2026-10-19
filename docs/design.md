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

Hono の Worker は静的配信と SPA フォールバックだけを担う。API は持たない。

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
  id: string;            // "basics"
  title: string;
  description: string;
  pages: Page[];         // 0 始まり。URL は 1 始まり
};
type Page = {
  title: string;
  blocks: Block[];
  code?: { name: string; content: string }; // .play のファイル。OMIT 行を除去済み
};
type Block =
  | { id: string; hash: string; kind: "p"; text: string }         // 段落
  | { id: string; hash: string; kind: "list"; items: string[] }   // "- " で始まる箇条書き
  | { id: string; kind: "pre"; text: string }                     // タブ字下げのコードブロック（訳さない）
  | { id: string; kind: "image"; src: string };                   // .image（訳さない）
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
- 出力は `GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w"`。生成物はコミットせず、ビルド時に作る
- Go のバージョンは mise で固定する

### Web Worker との通信

```ts
// main → worker
{ type: "run"; runId: string; code: string }
// worker → main
{ type: "ready" }
{ type: "stdout" | "stderr"; runId: string; data: string }
{ type: "image"; runId: string; dataUrl: string }   // pic の "IMAGE:" 行を変換したもの
{ type: "exit"; runId: string; ok: boolean; error?: string; ms: number }
```

- 1 回の実行ごとに出力を順に流す。`IMAGE:` は行単位でバッファしてから画像に変換する
- タイムアウト（既定 10 秒）か停止ボタンで `worker.terminate()` を呼び、Worker を作り直す
- 事前ビルド済みのパッケージ（x/tour）が書く os.Stdout は、同期的に回収する
  （PoC で Node.js の非同期 fs が deadlock することを確認済み）

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
- 新バージョンは「更新があります」の通知を出し、ユーザーの操作で切り替える

## 実機での確認事項

iOS Safari と Android Chrome の両方で次を確認する。

1. 機内モードで起動でき、`concurrency/select.go` と `methods/exercise-images.go` の解答が動く
2. wasm の初回ロード時間と、2 回目以降（キャッシュから）の起動時間
3. メモリ不足でタブが落ちないか（wasm は約 22MB、配信時は圧縮）
4. Cloudflare の配信で `yaegi.wasm` が圧縮されているか（`content-encoding` を見る）

## 進め方

1. テンプレートの整理と、実行エンジンのスパイク（wasm + Web Worker + Service Worker の最小ページ）。実機で確認する
2. コンテンツパイプライン（`scripts/content`、`content/en`）
3. 翻訳（`content/ja`）。レッスン単位で並列に進め、最後に用語を統一する
4. 本体 UI（レッスン一覧、対訳表示、エディタ、実行結果、進捗）
5. PWA の仕上げ（インストール導線、更新通知、帰属表示）
