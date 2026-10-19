import type { GoRunEvent, GoRunResult } from '@/react-app/shared/lib';
import type { GoRunnerEngine } from './CodeRunner';

export const STORAGE_KEY = 'basics/1';
export const CODE_HASH = 'code-hash-v1';

export const SAMPLE_CODE = `package main

import "fmt"

func main() {
	fmt.Println("Hello, 世界")
}
`;

export const EDITED_CODE = `package main

import "fmt"

func main() {
	fmt.Println("edited")
}
`;

/** gofmt 済みのコード。モックの format は SAMPLE_CODE をこれに置き換える。 */
export const FORMATTED_CODE = `package main

import "fmt"

func main() { fmt.Println("Hello, 世界") }
`;

/** go/parser が返す構文エラーの形（行:列: 内容）。 */
export const FORMAT_ERROR = "3:12: expected ')', found '{'";

interface MockEngineOptions {
  events?: GoRunEvent[];
  result?: GoRunResult;
  preload?: GoRunnerEngine['preload'];
  run?: GoRunnerEngine['run'];
  format?: GoRunnerEngine['format'];
}

/** 実行エンジンを差し替えて、wasm なしで UI の振る舞いを検証する。 */
export function createMockEngine(options: MockEngineOptions = {}): GoRunnerEngine {
  const result = options.result ?? { status: 'ok', ms: 7 };
  return {
    preload: options.preload ?? (() => Promise.resolve({ loadMs: 0 })),
    run:
      options.run ??
      (async (_code, runOptions) => {
        for (const event of options.events ?? []) {
          runOptions?.onEvent?.(event);
        }
        runOptions?.onEvent?.({
          type: 'exit',
          ok: result.status === 'ok',
          error: result.error,
          ms: result.ms,
          status: result.status,
        });
        return result;
      }),
    format: options.format ?? (() => Promise.resolve({ status: 'ok', code: FORMATTED_CODE })),
  };
}

/** wasm の初回ロードが終わらない状態を再現する。 */
export function createPreparingEngine(): GoRunnerEngine {
  return {
    preload: () => new Promise<never>(() => {}),
    run: () => new Promise<never>(() => {}),
    format: () => new Promise<never>(() => {}),
  };
}

/** 停止ボタンで AbortSignal が伝わることを確かめるためのエンジン。 */
export function createStopEngine(): GoRunnerEngine {
  return {
    preload: () => Promise.resolve({ loadMs: 0 }),
    run: (_code, options) =>
      new Promise<GoRunResult>((resolve) => {
        options?.onEvent?.({ type: 'stdout', data: 'running\n' });
        const onAbort = () => {
          options?.onEvent?.({
            type: 'exit',
            ok: false,
            error: '実行を停止しました',
            ms: 12,
            status: 'cancelled',
          });
          resolve({ status: 'cancelled', error: '実行を停止しました', ms: 12 });
        };
        if (options?.signal?.aborted === true) {
          onAbort();
          return;
        }
        options?.signal?.addEventListener('abort', onAbort, { once: true });
      }),
    format: () => Promise.resolve({ status: 'ok', code: FORMATTED_CODE }),
  };
}
