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

export interface GoWorkerFormattedMessage {
  type: 'formatted';
  reqId: string;
  ok: boolean;
  /** ok のときだけ入る整形後のコード */
  code?: string;
  /** 構文エラーなどで整形できなかったときだけ入る（`行:列: 内容`） */
  error?: string;
}

export type GoWorkerEvent =
  | GoWorkerReadyMessage
  | GoWorkerOutputMessage
  | GoWorkerImageMessage
  | GoWorkerExitMessage
  | GoWorkerFormattedMessage;

export interface GoWorkerRunMessage {
  type: 'run';
  runId: string;
  code: string;
}

export interface GoWorkerFormatMessage {
  type: 'format';
  reqId: string;
  code: string;
}

export type GoWorkerRequest = GoWorkerRunMessage | GoWorkerFormatMessage;

export function isGoWorkerEvent(value: unknown): value is GoWorkerEvent {
  if (value === null || typeof value !== 'object' || !('type' in value)) return false;
  const type = value.type;
  if (type === 'ready') return true;
  if (type === 'formatted') {
    return (
      'reqId' in value &&
      typeof value.reqId === 'string' &&
      'ok' in value &&
      typeof value.ok === 'boolean' &&
      (!('code' in value) || typeof value.code === 'string') &&
      (!('error' in value) || typeof value.error === 'string')
    );
  }
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

export function isGoWorkerFormatMessage(value: unknown): value is GoWorkerFormatMessage {
  if (value === null || typeof value !== 'object') return false;
  if (!('type' in value) || value.type !== 'format') return false;
  if (!('reqId' in value) || typeof value.reqId !== 'string') return false;
  return 'code' in value && typeof value.code === 'string';
}
