# 翻訳ガイド

`content/en/<lesson>.json` を訳して `content/ja/<lesson>.json` を作るときの決まり。
データ形式と検証項目は `docs/design.md` の「日本語訳」節を参照。

## 形式

- 訳すのは `kind: "p"` の `text` と `kind: "list"` の `items`、レッスンの `title` / `description`、ページの `title`
- `pre` と `image` と `code` は訳さない（ja には含めない）
- block id ごとに 1 対 1 で訳す。段落を分けたり、まとめたり、省いたりしない
- `hash` は英語 block の `hash` をそのまま写す
- インライン記法は原文と同じものを残す
  - `` `code` `` の中身は 1 文字も変えない。数も原文と同じにする
  - `[[url][label]]` は url を変えず、label だけ訳す
  - `_italic_` と `*bold*` は、訳文の対応する語に付け直す
- 「16 行目」のような行番号やファイル名は原文のまま
- 訳注は入れない

## 文体

- です・ます調。読者は Go の初学者だが、プログラミング経験はある
- 原文の意味を変えない範囲で、日本語として自然な語順にする。直訳調の「〜することができます」は「〜できます」にする
- 英数字・インラインコードと和文の間には半角スペースを入れる（例: 「Go のプログラム」「`fmt` パッケージ」）。句読点や括弧の隣には入れない
- 句読点は「、」「。」。括弧は全角の「（）」。ただしインラインコード内は原文のまま
- コロンは半角の「: 」を使う（例: 「ヒント: 型変換を使います」）。文末でコードや一覧を導く場合は「。」で終える
- 強調記法（`_..._` / `*...*`）の前後は半角スペースで区切る（句読点・括弧の隣は不要）。強調を続けて並べるときは、間に句読点を挟む
- 原文の "you" は基本的に訳さない

## 用語

| 英語                                       | 訳語                                             |
| ------------------------------------------ | ------------------------------------------------ |
| package / import / exported name           | パッケージ / インポート / エクスポートされた名前 |
| variable / constant / zero value           | 変数 / 定数 / ゼロ値                             |
| type conversion / type inference           | 型変換 / 型推論                                  |
| function / function value / closure        | 関数 / 関数値 / クロージャ                       |
| pointer / dereference / indirection        | ポインタ / デリファレンス / 間接参照             |
| struct / field / struct literal            | 構造体 / フィールド / 構造体リテラル             |
| array / slice / map                        | 配列 / スライス / マップ                         |
| length / capacity                          | 長さ / 容量                                      |
| method / receiver                          | メソッド / レシーバ                              |
| value receiver / pointer receiver          | 値レシーバ / ポインタレシーバ                    |
| interface / empty interface                | インターフェース / 空のインターフェース          |
| implement / satisfy（interface）           | 実装する / 満たす                                |
| type assertion / type switch               | 型アサーション / 型スイッチ                      |
| type parameter / constraint / generic type | 型パラメータ / 制約 / ジェネリック型             |
| generics                                   | ジェネリクス                                     |
| goroutine / channel                        | ゴルーチン / チャネル                            |
| buffered channel                           | バッファ付きチャネル                             |
| mutex / mutual exclusion                   | ミューテックス / 排他制御                        |
| concurrency / parallelism                  | 並行性 / 並列性                                  |
| boolean / boolean type                     | 真偽値 / 真偽値型                                |
| underlying array / backing array           | 基になる配列                                     |
| underlying type / underlying value         | 基底型 / 基底の値                                |
| concrete type / concrete value             | 具象型 / 具象値                                  |
| behavior                                   | 振る舞い                                         |
| panic（現象） / `panic`（関数）            | パニック / `panic`                               |
| generator / web crawler                    | ジェネレータ / Web クローラ                      |
| naked return                               | 裸の return                                      |
| case（switch / select）                    | case（原文でコードになっていない場合はそのまま） |
| initializer                                | 初期化子                                         |
| function signature / method signature      | 関数シグネチャ / メソッドシグネチャ              |
| statement / expression                     | ステートメント / 式                              |
| loop / condition                           | ループ / 条件                                    |
| error                                      | エラー（型を指すときは `error`）                 |
| Exercise: Xxx（ページ名）                  | 演習: Xxx を訳したもの（例: 「演習: スライス」） |
| Congratulations!（ページ名）               | おめでとうございます！                           |
| the Go Playground                          | Go Playground                                    |
| the tour                                   | ツアー                                           |

- Go のキーワード・組み込み関数・型名（`for`, `defer`, `select`, `make`, `nil`, `int` など）は、本文で単語として使われていてもコードとして扱い、訳さない
- ただし原文でキーワードがコードになっていない箇所（`switch` の case など）は、コードの数を原文と合わせるため、地の文でもそのまま書く
- 長音記号: 末尾の長音は付けない（パラメータ、ポインタ、レシーバ、コンピュータ、ジェネレータ、クローラ）。ただし「インターフェース」「エラー」は慣用に従う
- 表にない用語で迷ったら、Go の公式ドキュメントの日本語訳や旧訳（go-tour-jp）で定着している語を使う
