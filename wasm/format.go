// Go ソースの整形（gofmt）。build 制約を付けないので、ホスト向け `go test` からも
// 同じ実装を検証できる（js/wasm 向けの公開は main.go が行う）。
package main

import (
	"go/format"
)

// formatResult は JavaScript へ返す整形結果。main.go が JSON 化する。
type formatResult struct {
	OK    bool   `json:"ok"`
	Code  string `json:"code,omitempty"`
	Error string `json:"error,omitempty"`
}

// formatSource は gofmt（go/format.Source）と同じ整形を行う。
// 構文エラーのときは Error に `行:列: 内容` の形で入り、Code は空のままにする。
func formatSource(source string) formatResult {
	formatted, err := format.Source([]byte(source))
	if err != nil {
		return formatResult{Error: err.Error()}
	}
	return formatResult{OK: true, Code: string(formatted)}
}
