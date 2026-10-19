/**
 * Go 実行 Worker の main スレッド側 API。
 *
 * - `preloadGo()` — Worker を起動して wasm を読み込む。初回のロード時間を返す
 * - `runGo(code, options)` — 実行し、出力イベントを `onEvent` に流す。完了まで待つ
 * - タイムアウト・AbortSignal・Worker クラッシュでは Worker を terminate して作り直す
 */
import { isGoWorkerEvent, type GoWorkerRequest } from './goProtocol';

export const DEFAULT_GO_TIMEOUT_MS = 10_000;

export type GoRunEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'image'; dataUrl: string }
  | { type: 'exit'; ok: boolean; error?: string; ms: number };

export type GoRunStatus = 'ok' | 'error' | 'timeout' | 'cancelled' | 'crashed' | 'busy';

export interface GoRunResult {
  status: GoRunStatus;
  error?: string;
  ms: number;
}

export interface GoRunOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  onEvent?: (event: GoRunEvent) => void;
}

export interface GoPreloadResult {
  /** Worker の生成から wasm の初期化完了までの時間 */
  loadMs: number;
}

interface ActiveRun {
  runId: string;
  onEvent: ((event: GoRunEvent) => void) | undefined;
  resolve: (result: GoRunResult) => void;
  timer: ReturnType<typeof setTimeout> | null;
  removeAbortListener: (() => void) | null;
  startedAt: number;
  settled: boolean;
}

interface ReadyState {
  promise: Promise<GoPreloadResult>;
  resolve: (result: GoPreloadResult) => void;
  reject: (error: Error) => void;
  startedAt: number;
}

function createReadyDeferred(): {
  promise: Promise<GoPreloadResult>;
  resolve: (r: GoPreloadResult) => void;
  reject: (e: Error) => void;
} {
  let resolveFn: ((result: GoPreloadResult) => void) | undefined;
  let rejectFn: ((error: Error) => void) | undefined;
  const promise = new Promise<GoPreloadResult>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });
  return {
    promise,
    resolve: (result) => resolveFn?.(result),
    reject: (error) => rejectFn?.(error),
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

class GoRunner {
  private worker: Worker | null = null;
  private ready: ReadyState | null = null;
  private loaded: GoPreloadResult | null = null;
  private active: ActiveRun | null = null;

  preload(): Promise<GoPreloadResult> {
    if (this.loaded !== null) return Promise.resolve(this.loaded);
    if (this.ready !== null) return this.ready.promise;

    const deferred = createReadyDeferred();
    this.ready = { ...deferred, startedAt: performance.now() };

    const worker = new Worker(new URL('./goRunner.worker.ts', import.meta.url), {
      type: 'module',
      name: 'go-runner',
    });
    worker.addEventListener('message', (event: MessageEvent<unknown>) => {
      this.handleMessage(event.data);
    });
    worker.addEventListener('error', (event) => {
      this.handleCrash(event.message.length > 0 ? event.message : 'Worker が予期せず停止しました');
    });
    worker.addEventListener('messageerror', () => {
      this.handleCrash('Worker から不正なメッセージを受け取りました');
    });
    this.worker = worker;
    return this.ready.promise;
  }

  async run(code: string, options: GoRunOptions = {}): Promise<GoRunResult> {
    const { timeoutMs = DEFAULT_GO_TIMEOUT_MS, signal, onEvent } = options;
    if (this.active !== null) {
      return this.emitAndReturn(onEvent, 'busy', '別のコードを実行中です', 0);
    }
    if (signal?.aborted) {
      return this.emitAndReturn(onEvent, 'cancelled', '実行を停止しました', 0);
    }

    try {
      await this.preload();
    } catch (error) {
      return this.emitAndReturn(onEvent, 'crashed', describeError(error), 0);
    }

    if (signal?.aborted) {
      return this.emitAndReturn(onEvent, 'cancelled', '実行を停止しました', 0);
    }
    if (this.active !== null) {
      return this.emitAndReturn(onEvent, 'busy', '別のコードを実行中です', 0);
    }

    return new Promise<GoRunResult>((resolve) => {
      const runId = crypto.randomUUID();
      const active: ActiveRun = {
        runId,
        onEvent,
        resolve,
        timer: null,
        removeAbortListener: null,
        startedAt: performance.now(),
        settled: false,
      };
      this.active = active;
      active.timer = setTimeout(() => {
        this.finish(active, 'timeout', `実行が ${timeoutMs} ms を超えたため停止しました`);
      }, timeoutMs);

      if (signal !== undefined) {
        const onAbort = () => {
          this.finish(active, 'cancelled', '実行を停止しました');
        };
        signal.addEventListener('abort', onAbort, { once: true });
        active.removeAbortListener = () => signal.removeEventListener('abort', onAbort);
      }

      const worker = this.worker;
      if (worker === null) {
        this.finish(active, 'crashed', 'Worker が初期化されていません');
        return;
      }
      const message: GoWorkerRequest = { type: 'run', runId, code };
      // Dedicated Worker の postMessage は第 2 引数が transfer list なので origin は渡さない
      // oxlint-disable-next-line unicorn/require-post-message-target-origin
      worker.postMessage(message);
    });
  }

  dispose(): void {
    const active = this.active;
    if (active !== null) this.finish(active, 'cancelled', '実行を停止しました');
    this.resetWorker();
  }

  private handleMessage(value: unknown): void {
    if (!isGoWorkerEvent(value)) return;
    switch (value.type) {
      case 'ready': {
        const ready = this.ready;
        if (ready === null) return;
        this.ready = null;
        if (value.error !== undefined) {
          this.resetWorker();
          ready.reject(new Error(value.error));
          return;
        }
        const result: GoPreloadResult = { loadMs: Math.round(performance.now() - ready.startedAt) };
        this.loaded = result;
        ready.resolve(result);
        return;
      }
      case 'stdout':
      case 'stderr':
      case 'image': {
        this.forwardRunEvent(value.runId, value);
        return;
      }
      case 'exit': {
        const active = this.active;
        if (active === null || active.runId !== value.runId) return;
        if (value.ok) {
          this.finish(active, 'ok');
        } else {
          this.finish(active, 'error', value.error ?? '実行時にエラーが発生しました');
        }
        return;
      }
    }
  }

  private forwardRunEvent(
    runId: string,
    event: Extract<GoRunEvent, { type: 'stdout' | 'stderr' | 'image' }>,
  ): void {
    const active = this.active;
    if (active === null || active.runId !== runId || active.settled) return;
    active.onEvent?.(event);
  }

  private handleCrash(message: string): void {
    const ready = this.ready;
    const active = this.active;
    if (active !== null) {
      this.finish(active, 'crashed', message);
    }
    this.resetWorker();
    if (ready !== null) ready.reject(new Error(message));
  }

  private finish(active: ActiveRun, status: GoRunStatus, error?: string): void {
    if (active.settled) return;
    active.settled = true;
    if (active.timer !== null) clearTimeout(active.timer);
    active.removeAbortListener?.();
    if (this.active === active) this.active = null;

    const ms = Math.max(0, Math.round(performance.now() - active.startedAt));
    active.onEvent?.({ type: 'exit', ok: status === 'ok', error, ms });
    if (status === 'timeout' || status === 'cancelled' || status === 'crashed') {
      this.resetWorker();
    }
    active.resolve({ status, error, ms });
  }

  private emitAndReturn(
    onEvent: ((event: GoRunEvent) => void) | undefined,
    status: GoRunStatus,
    error: string,
    ms: number,
  ): GoRunResult {
    onEvent?.({ type: 'exit', ok: false, error, ms });
    return { status, error, ms };
  }

  private resetWorker(): void {
    const worker = this.worker;
    this.worker = null;
    if (worker !== null) {
      worker.terminate();
    }
    this.ready = null;
    this.loaded = null;
  }
}

const goRunner = new GoRunner();

export function preloadGo(): Promise<GoPreloadResult> {
  return goRunner.preload();
}

export function runGo(code: string, options?: GoRunOptions): Promise<GoRunResult> {
  return goRunner.run(code, options);
}

export function disposeGo(): void {
  goRunner.dispose();
}
