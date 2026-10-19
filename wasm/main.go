//go:build js && wasm

// Command yaegi-wasm exposes runGo(source, emit) and formatGo(source) to
// JavaScript. runGo interprets a complete Go program (package main + func main)
// with Yaegi, streams the program output through emit, and returns a small JSON
// result. formatGo formats Go source with go/format (gofmt).
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"syscall/js"
	"time"

	"github.com/traefik/yaegi/interp"

	"github.com/hushin-sandbox/go-tour-pocket/wasm/ministd"
	"github.com/hushin-sandbox/go-tour-pocket/wasm/toursyms"
)

// emitFunc is called synchronously for every chunk of interpreted stdout /
// stderr. The worker forwards the chunks to the main thread as they arrive.
type emitFunc func(kind, data string)

// jsWriter connects an interp.Options writer to the JavaScript emit callback.
// Writes are never buffered so that output shows up in the UI immediately.
type jsWriter struct {
	kind string
	emit emitFunc
}

func (w jsWriter) Write(p []byte) (int, error) {
	if len(p) > 0 {
		w.emit(w.kind, string(p))
	}
	return len(p), nil
}

type runResult struct {
	Error string `json:"error,omitempty"`
	MS    int64  `json:"ms"`
}

func runGo(source string, emit emitFunc) (result runResult) {
	start := time.Now()
	defer func() {
		if r := recover(); r != nil && result.Error == "" {
			result.Error = fmt.Sprint("panic: ", r)
		}
		result.MS = time.Since(start).Milliseconds()
	}()

	i := interp.New(interp.Options{
		Stdout: jsWriter{kind: "stdout", emit: emit},
		Stderr: jsWriter{kind: "stderr", emit: emit},
	})
	for _, symbols := range []map[string]map[string]reflect.Value{
		ministd.Symbols,
		toursyms.Symbols,
	} {
		if err := i.Use(symbols); err != nil {
			result.Error = err.Error()
			return result
		}
	}
	if _, err := i.Eval(source); err != nil {
		result.Error = err.Error()
	}
	return result
}

func main() {
	// Interpreted programs that touch os.Stdout/os.Stderr must use the
	// interp.Options writers instead of the native file descriptors.
	_ = os.Setenv("YAEGI_SPECIAL_STDIO", "1")

	js.Global().Set("formatGo", js.FuncOf(func(_ js.Value, args []js.Value) any {
		if len(args) < 1 {
			return `{"ok":false,"error":"formatGo: missing source argument"}`
		}
		encoded, err := json.Marshal(formatSource(args[0].String()))
		if err != nil {
			return `{"ok":false,"error":"formatGo: marshal failure"}`
		}
		return string(encoded)
	}))

	js.Global().Set("runGo", js.FuncOf(func(_ js.Value, args []js.Value) any {
		if len(args) < 1 {
			return `{"error":"runGo: missing source argument","ms":0}`
		}
		emit := func(string, string) {}
		if len(args) >= 2 && args[1].Type() == js.TypeFunction {
			callback := args[1]
			emit = func(kind, data string) {
				callback.Invoke(kind, data)
			}
		}
		encoded, err := json.Marshal(runGo(args[0].String(), emit))
		if err != nil {
			return `{"error":"runGo: marshal failure","ms":0}`
		}
		return string(encoded)
	}))
	// The worker polls this flag before it sends its "ready" message.
	js.Global().Set("yaegiReady", true)
	// Keep the Go runtime (and therefore the wasm instance) alive. The only way
	// to stop an interpreted program is to terminate the whole Web Worker.
	select {}
}
