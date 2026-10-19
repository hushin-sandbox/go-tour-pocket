/**
 * Go 実行用の Dedicated Worker。
 *
 * wasm_exec.js を読み込んで Yaegi の wasm を起動し、main からの run メッセージごとに
 * `runGo(source, emit)` を同期的に呼ぶ。無限ループはこの Worker を terminate する
 * 以外に止められないため、main 側はタイムアウト・停止時に Worker ごと作り直す。
 */
import { GoOutputSplitter } from './goOutput';
import { isGoWorkerRunMessage, type GoWorkerEvent } from './goProtocol';

const splitter = new GoOutputSplitter();
const decoder = new TextDecoder();

let activeRunId: string | null = null;

function post(message: GoWorkerEvent): void {
  // Dedicated Worker の postMessage は第 2 引数が transfer list なので origin は渡さない
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  postMessage(message);
}

function emit(kind: 'stdout' | 'stderr', data: string): void {
  const runId = activeRunId;
  if (runId === null || data.length === 0) return;
  for (const chunk of splitter.push(kind, data)) {
    post({ ...chunk, runId });
  }
}

/**
 * wasm_exec.js が用意する fs.writeSync を差し替える。x/tour/pic や x/tour/wc のような
 * ビルド済みパッケージは native の os.Stdout へ書くため、ここで回収しないと出力が
 * console に流れてしまう。
 */
function interceptNativeStdio(): void {
  const wasmFs = globalThis.fs;
  if (wasmFs === undefined) return;
  const originalWriteSync = wasmFs.writeSync.bind(wasmFs);
  wasmFs.writeSync = (fd, buf) => {
    if (fd === 1 || fd === 2) {
      emit(fd === 1 ? 'stdout' : 'stderr', decoder.decode(buf));
      return buf.length;
    }
    return originalWriteSync(fd, buf);
  };
}

/** Go の main が runGo を登録するまで待つ */
function waitForYaegiRuntime(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = performance.now() + timeoutMs;
    const poll = () => {
      if (yaegiReady === true) {
        resolve();
        return;
      }
      if (performance.now() > deadline) {
        reject(new Error('Go ランタイムの初期化がタイムアウトしました'));
        return;
      }
      setTimeout(poll, 10);
    };
    poll();
  });
}

/**
 * wasm_exec.js は Go が同梱する古典的なスクリプトで、`globalThis.Go` を定義する。
 * public 配下のファイルは Vite のモジュールグラフに載せられない（import すると dev で
 * エラーになる）ため、取得したソースをグローバルスコープで評価する。
 */
async function loadWasmExec(): Promise<void> {
  const response = await fetch('/wasm/wasm_exec.js');
  if (!response.ok) {
    throw new Error(`wasm_exec.js の取得に失敗しました (${response.status})`);
  }
  const source = await response.text();
  // oxlint-disable-next-line no-eval
  (0, eval)(source);
}

async function start(): Promise<void> {
  await loadWasmExec();
  interceptNativeStdio();

  if (typeof Go === 'undefined') {
    throw new Error('wasm_exec.js から Go が定義されませんでした');
  }
  const go = new Go();
  const response = await fetch('/wasm/yaegi.wasm');
  if (!response.ok) {
    throw new Error(`yaegi.wasm の取得に失敗しました (${response.status})`);
  }
  const module = await WebAssembly.compile(await response.arrayBuffer());
  const instance = await WebAssembly.instantiate(module, go.importObject);
  // Go の main は select{} で止まり続けるため、この Promise は解決しない
  void go.run(instance);
  await waitForYaegiRuntime(60_000);
  post({ type: 'ready' });
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function parseRunResult(value: unknown): { error?: string; ms: number } {
  if (value === null || typeof value !== 'object') return { ms: 0 };
  let error: string | undefined;
  if ('error' in value && typeof value.error === 'string' && value.error.length > 0) {
    error = value.error;
  }
  let ms = 0;
  if ('ms' in value && typeof value.ms === 'number') ms = value.ms;
  return error === undefined ? { ms } : { error, ms };
}

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const message: unknown = event.data;
  if (!isGoWorkerRunMessage(message) || activeRunId !== null) return;
  if (runGo === undefined) {
    post({
      type: 'exit',
      runId: message.runId,
      ok: false,
      error: 'Go ランタイムが初期化されていません',
      ms: 0,
    });
    return;
  }

  activeRunId = message.runId;
  try {
    const raw: unknown = JSON.parse(runGo(message.code, emit));
    const result = parseRunResult(raw);
    for (const kind of ['stdout', 'stderr'] as const) {
      const remaining = splitter.flush(kind);
      if (remaining !== undefined) post({ ...remaining, runId: message.runId });
    }
    post({
      type: 'exit',
      runId: message.runId,
      ok: result.error === undefined,
      error: result.error,
      ms: result.ms,
    });
  } catch (error) {
    post({
      type: 'exit',
      runId: message.runId,
      ok: false,
      error: describeError(error),
      ms: 0,
    });
  } finally {
    activeRunId = null;
  }
});

void start().catch((error: unknown) => {
  post({ type: 'ready', error: describeError(error) });
});
