package main

import (
	"strings"
	"testing"
)

func TestFormatSourceFormatsGoCode(t *testing.T) {
	got := formatSource("package main\nimport \"fmt\"\nfunc main(){fmt.Println(\"hi\")}\n")
	if got.Error != "" {
		t.Fatalf("formatSource returned an error: %s", got.Error)
	}
	want := "package main\n\nimport \"fmt\"\n\nfunc main() { fmt.Println(\"hi\") }\n"
	if got.Code != want {
		t.Fatalf("formatted code mismatch:\n got %q\nwant %q", got.Code, want)
	}
	if !got.OK {
		t.Fatal("OK should be true for a successful format")
	}
}

func TestFormatSourceLeavesFormattedCodeAlone(t *testing.T) {
	source := "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"hi\")\n}\n"
	got := formatSource(source)
	if got.Error != "" {
		t.Fatalf("formatSource returned an error: %s", got.Error)
	}
	if got.Code != source {
		t.Fatalf("gofmt 済みのコードが変わった:\n got %q\nwant %q", got.Code, source)
	}
}

func TestFormatSourceReportsSyntaxError(t *testing.T) {
	got := formatSource("package main\n\nfunc main( {\n")
	if got.OK {
		t.Fatal("OK should be false for a syntax error")
	}
	if got.Code != "" {
		t.Fatalf("Code should be empty on error, got %q", got.Code)
	}
	// go/parser のエラーは `行:列: 内容` の形。UI がそのまま行番号として出せること。
	if !strings.HasPrefix(got.Error, "3:") {
		t.Fatalf("error should start with the line number, got %q", got.Error)
	}
}
