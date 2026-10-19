# wasm — ブラウザ内 Go インタプリタ

A Tour of Go のコードをブラウザ内で実行するための Go モジュール。Yaegi を
`GOOS=js GOARCH=wasm` でビルドし、`runGo(source, emit)` と `formatGo(source)` を
JavaScript に公開する。

- `main.go` — js/wasm 向けの入口。`runGo` と `formatGo` をグローバルに登録する
- `format.go` — `formatGo` の実装（`go/format.Source`）。build 制約を付けていないので
  ホスト向けの `go test` からも呼べる
- `format_test.go` — `formatSource` の Go テスト
- `ministd/` — Tour が使う標準ライブラリのシンボル（`yaegi extract` の生成物 + `restricted.go`）
- `toursyms/` — `golang.org/x/tour` の pic / wc / tree / reader のシンボル（`yaegi extract` の生成物）

Yaegi は `go.mod` で固定する（`v0.16.2-0.20260209085605-fcb76d1ece0c`）。

## ビルド

```sh
mise run build:wasm
```

`public/wasm/yaegi.wasm` と、同じ Go バージョンの `wasm_exec.js` を書き出す。
`public/wasm/` は生成物なのでコミットしない。

## テスト

```sh
cd wasm && go test .
```

`format.go` は js/wasm のビルド制約を持たないため、ホストの Go でそのままテストできる。
実行時（wasm）の挙動は `pnpm e2e`（`scripts/e2e-app.mjs`）が実 wasm で確認する。

## シンボルの再生成

標準ライブラリの対象を変えるときは、`ministd/` で次を実行して生成物を置き換え、
`symbols.go` と `restricted.go` は手で維持する。

```sh
cd wasm/ministd
go run github.com/traefik/yaegi/cmd/yaegi@v0.16.2-0.20260209085605-fcb76d1ece0c extract \
  -name ministd fmt math math/cmplx math/rand strings time io os sync image image/color errors runtime log
```

`toursyms/` も同じ要領で `golang.org/x/tour/{pic,wc,tree,reader}` を抽出する。

## 既知の制約

- 無限ループは Web Worker の `terminate()` でしか止められない（Yaegi の Eval にキャンセル API は無い）
- 整形は `go/format.Source` と同じ（gofmt の `-s` による簡略化はしない）
- 実行中の整形はできない。Worker が実行でブロックされているため、UI はフォーマットボタンを無効にする
- `%T` の型名が gc と異なる場合がある
- `min` / `max` ビルトイン、`slices` / `maps` / `cmp`、`range over func`、`embed` は未対応
