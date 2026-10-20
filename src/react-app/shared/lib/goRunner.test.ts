import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GO_FATAL_RUNTIME_MESSAGE } from './goProtocol';
import type { GoRunEvent } from './goRunner';

type RunRequest = { type: 'run'; runId: string; code: string };
type FakeListener = (event: { data: unknown }) => void;

/**
 * `new Worker(...)` を差し替えるための最小の偽 Worker。実 wasm は使わず、
 * main 側の状態遷移（fatal で作り直すか、error なら使い回すか）だけを見る。
 */
class FakeWorker {
  static instances: FakeWorker[] = [];

  readonly posted: unknown[] = [];
  terminated = false;
  private readonly listeners = new Set<FakeListener>();

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: FakeListener): void {
    if (type === 'message') this.listeners.add(listener);
  }

  removeEventListener(_type: string, _listener: FakeListener): void {
    // goRunner は terminate 後にリスナーを外さないので、テスト用の実装は空でよい。
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emit(value: unknown): void {
    for (const listener of this.listeners) listener({ data: value });
  }
}

function lastWorker(): FakeWorker {
  const worker = FakeWorker.instances.at(-1);
  if (worker === undefined) throw new Error('Worker が生成されていない');
  return worker;
}

/** モジュールを読み込み、Worker の ready まで進めた runner を返す。 */
async function loadRunner(): Promise<typeof import('./goRunner')> {
  const runner = await import('./goRunner');
  const ready = runner.preloadGo();
  lastWorker().emit({ type: 'ready' });
  await ready;
  return runner;
}

function postedRun(worker: FakeWorker, index: number): RunRequest {
  const message = worker.posted[index];
  if (message === null || typeof message !== 'object') {
    throw new Error(`run メッセージがない: ${index}`);
  }
  if (!('type' in message) || message.type !== 'run') {
    throw new Error(`run メッセージではない: ${index}`);
  }
  if (!('runId' in message) || typeof message.runId !== 'string') {
    throw new Error(`runId がない: ${index}`);
  }
  if (!('code' in message) || typeof message.code !== 'string') {
    throw new Error(`code がない: ${index}`);
  }
  return { type: 'run', runId: message.runId, code: message.code };
}

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('GoRunner', () => {
  it('fatal な exit は crashed にして Worker を作り直す', async () => {
    const runner = await loadRunner();
    const worker = lastWorker();
    const events: GoRunEvent[] = [];

    const run = runner.runGo('package main', { onEvent: (event) => events.push(event) });
    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    const request = postedRun(worker, 0);

    worker.emit({
      type: 'stderr',
      runId: request.runId,
      data: 'fatal error: all goroutines are asleep - deadlock!\n',
    });
    worker.emit({
      type: 'exit',
      runId: request.runId,
      ok: false,
      fatal: true,
      error: GO_FATAL_RUNTIME_MESSAGE,
      ms: 5,
    });

    const result = await run;
    expect(result.status).toBe('crashed');
    expect(result.error).toBe(GO_FATAL_RUNTIME_MESSAGE);
    expect(worker.terminated).toBe(true);
    expect(events.map((event) => event.type)).toEqual(['stderr', 'exit']);
    expect(events.at(-1)).toMatchObject({
      type: 'exit',
      ok: false,
      status: 'crashed',
      error: GO_FATAL_RUNTIME_MESSAGE,
    });

    // 次の実行では新しい Worker を作り、ready を待ってから run を送る。
    const nextRun = runner.runGo('package main');
    await vi.waitFor(() => expect(FakeWorker.instances).toHaveLength(2));
    const nextWorker = lastWorker();
    expect(nextWorker).not.toBe(worker);
    nextWorker.emit({ type: 'ready' });
    await vi.waitFor(() => expect(nextWorker.posted).toHaveLength(1));
    const nextRequest = postedRun(nextWorker, 0);
    nextWorker.emit({ type: 'exit', runId: nextRequest.runId, ok: true, ms: 1 });

    expect((await nextRun).status).toBe('ok');
  });

  it('fatal でない exit は error のまま Worker を使い回す', async () => {
    const runner = await loadRunner();
    const worker = lastWorker();

    const run = runner.runGo('package main');
    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    const request = postedRun(worker, 0);
    worker.emit({ type: 'exit', runId: request.runId, ok: false, error: 'exit status 1', ms: 2 });

    const result = await run;
    expect(result.status).toBe('error');
    expect(result.error).toBe('exit status 1');
    expect(worker.terminated).toBe(false);

    const nextRun = runner.runGo('package main');
    await vi.waitFor(() => expect(worker.posted).toHaveLength(2));
    const nextRequest = postedRun(worker, 1);
    expect(nextRequest.runId).not.toBe(request.runId);
    worker.emit({ type: 'exit', runId: nextRequest.runId, ok: true, ms: 1 });

    expect((await nextRun).status).toBe('ok');
    expect(FakeWorker.instances).toHaveLength(1);
  });
});
