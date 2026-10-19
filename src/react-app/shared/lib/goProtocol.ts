/**
 * main スレッドと Go 実行 Worker の間のメッセージ定義（docs/design.md の通信プロトコル）。
 */

export interface GoWorkerReadyMessage {
  type: 'ready';
  /** wasm の読み込みに失敗したときだけ入る */
  error?: string;
}

export interface GoWorkerOutputMessage {
  type: 'stdout' | 'stderr';
  runId: string;
  data: string;
}

export interface GoWorkerImageMessage {
  type: 'image';
  runId: string;
  dataUrl: string;
}

export interface GoWorkerExitMessage {
  type: 'exit';
  runId: string;
  ok: boolean;
  error?: string;
  ms: number;
}

export type GoWorkerEvent =
  | GoWorkerReadyMessage
  | GoWorkerOutputMessage
  | GoWorkerImageMessage
  | GoWorkerExitMessage;

export interface GoWorkerRunMessage {
  type: 'run';
  runId: string;
  code: string;
}

export type GoWorkerRequest = GoWorkerRunMessage;

export function isGoWorkerEvent(value: unknown): value is GoWorkerEvent {
  if (value === null || typeof value !== 'object' || !('type' in value)) return false;
  const type = value.type;
  if (type === 'ready') return true;
  if (!('runId' in value) || typeof value.runId !== 'string') return false;
  if (type === 'stdout' || type === 'stderr') {
    return 'data' in value && typeof value.data === 'string';
  }
  if (type === 'image') {
    return 'dataUrl' in value && typeof value.dataUrl === 'string';
  }
  if (type === 'exit') {
    return (
      'ok' in value &&
      typeof value.ok === 'boolean' &&
      'ms' in value &&
      typeof value.ms === 'number'
    );
  }
  return false;
}

export function isGoWorkerRunMessage(value: unknown): value is GoWorkerRunMessage {
  if (value === null || typeof value !== 'object') return false;
  if (!('type' in value) || value.type !== 'run') return false;
  if (!('runId' in value) || typeof value.runId !== 'string') return false;
  return 'code' in value && typeof value.code === 'string';
}
