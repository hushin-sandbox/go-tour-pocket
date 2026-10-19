/**
 * public/wasm/wasm_exec.js と wasm/main.go が公開するグローバルの型。
 * wasm_exec.js は ES モジュールとして読み込むだけで、この型の実体は持たない。
 */

interface GoWasmFs {
  writeSync(fd: number, buf: Uint8Array): number;
  write(
    fd: number,
    buf: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
    callback: (error: Error | null, written?: number) => void,
  ): void;
}

interface GoWasmInstance {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

type GoEmit = (kind: 'stdout' | 'stderr', data: string) => void;

declare const Go: { new (): GoWasmInstance };

declare var fs: GoWasmFs | undefined;

declare var runGo: ((source: string, emit: GoEmit) => string) | undefined;

/**
 * go/format（gofmt）で整形した結果を JSON 文字列で返す。
 * 成功時は `{"ok":true,"code":"..."}`、失敗時は `{"ok":false,"error":"行:列: 内容"}`。
 */
declare var formatGo: ((source: string) => string) | undefined;

declare var yaegiReady: boolean | undefined;
