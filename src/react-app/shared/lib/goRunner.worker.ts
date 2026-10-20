/**
 * Go 実行用の Dedicated Worker。
 *
 * wasm_exec.js を読み込んで Yaegi の wasm を起動し、main からの run メッセージごとに
 * `runGo(source, emit)` を同期的に呼ぶ。無限ループはこの Worker を terminate する
 * 以外に止められないため、main 側はタイムアウト・停止時に Worker ごと作り直す。
 */
import { GoOutputSplitter } from './goOutput';
import {
  GO_FATAL_RUNTIME_MESSAGE,
  isGoWorkerFormatMessage,
  isGoWorkerRunMessage,
  type GoWorkerEvent,
  type GoWorkerFormatMessage,
  type GoWorkerRunMessage,
} from './goProtocol';

const splitter = new GoOutputSplitter();
const decoder = new TextDecoder();

let activeRunId: string | null = null;

/** wasm_exec.js の Go インスタンス。ランタイム自体が終了したかの判定に使う。 */
let goRuntime: GoWasmInstance | null = null;

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
  // fatal error でランタイムが終了するとき、全ゴルーチンのスタックダンプを出さない。
  // `fatal error: all goroutines are asleep - deadlock!` の 1 行目は残る。
  go.env.GOTRACEBACK = 'none';
  goRuntime = go;
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

function flushOutput(runId: string): void {
  for (const kind of ['stdout', 'stderr'] as const) {
    const remaining = splitter.flush(kind);
    if (remaining !== undefined) post({ ...remaining, runId });
  }
}

/** fatal error（デッドロックなど）で Go ランタイムごと終了したときの結果。 */
function fatalResult(startedAt: number): {
  ok: false;
  error: string;
  ms: number;
  fatal: true;
} {
  return {
    ok: false,
    fatal: true,
    error: GO_FATAL_RUNTIME_MESSAGE,
    ms: Math.max(0, Math.round(performance.now() - startedAt)),
  };
}

/**
 * run リクエストを 1 回処理する。Go の deadlock などでランタイムが終了すると
 * `runGo` は文字列を返さない（または `Go program has already exited` を投げる）。
 * その場合は fatal を付けて、main 側に Worker の作り直しを促す。
 */
function handleRun(message: GoWorkerRunMessage): void {
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
  const startedAt = performance.now();
  let result: { ok: boolean; error?: string; ms: number; fatal?: boolean };

  try {
    if (goRuntime === null) {
      result = { ok: false, error: 'Go ランタイムが初期化されていません', ms: 0 };
    } else if (goRuntime.exited) {
      result = fatalResult(startedAt);
    } else {
      const raw: unknown = runGo(message.code, emit);
      if (typeof raw !== 'string' || goRuntime.exited) {
        result = fatalResult(startedAt);
      } else {
        const parsed = parseRunResult(JSON.parse(raw));
        result = {
          ok: parsed.error === undefined,
          error: parsed.error,
          ms: parsed.ms,
        };
      }
    }
  } catch (error) {
    const errorMessage = describeError(error);
    result =
      goRuntime?.exited === true || errorMessage.includes('Go program has already exited')
        ? fatalResult(startedAt)
        : { ok: false, error: errorMessage, ms: Math.round(performance.now() - startedAt) };
  }

  flushOutput(message.runId);
  post({ type: 'exit', runId: message.runId, ...result });
  activeRunId = null;
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

function parseFormatResult(value: unknown): { ok: boolean; code?: string; error?: string } {
  if (value === null || typeof value !== 'object') return { ok: false };
  if (!('ok' in value) || typeof value.ok !== 'boolean') return { ok: false };
  if (!value.ok) {
    if ('error' in value && typeof value.error === 'string' && value.error.length > 0) {
      return { ok: false, error: value.error };
    }
    return { ok: false, error: 'フォーマットに失敗しました' };
  }
  if (!('code' in value) || typeof value.code !== 'string') {
    return { ok: false, error: 'フォーマット結果が不正です' };
  }
  return { ok: true, code: value.code };
}

/**
 * 整形は Go の関数を同期的に呼ぶだけで、実行中の run と違って出力を伴わない。
 * Worker 自体は実行中ブロックされるため、実行中に届いた format は run の終了後に
 * 処理される（UI 側は実行中に整形ボタンを無効にするので通常は起きない）。
 */
function handleFormat(message: GoWorkerFormatMessage): void {
  const respond = (result: { ok: boolean; code?: string; error?: string }) => {
    post({ type: 'formatted', reqId: message.reqId, ...result });
  };
  if (formatGo === undefined) {
    respond({ ok: false, error: 'Go ランタイムが初期化されていません' });
    return;
  }
  try {
    respond(parseFormatResult(JSON.parse(formatGo(message.code))));
  } catch (error) {
    respond({ ok: false, error: describeError(error) });
  }
}

self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const message: unknown = event.data;
  if (isGoWorkerFormatMessage(message)) {
    handleFormat(message);
    return;
  }
  if (!isGoWorkerRunMessage(message) || activeRunId !== null) return;
  handleRun(message);
});

void start().catch((error: unknown) => {
  post({ type: 'ready', error: describeError(error) });
});
