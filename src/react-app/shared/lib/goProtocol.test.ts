import { isGoWorkerEvent, isGoWorkerFormatMessage, isGoWorkerRunMessage } from './goProtocol';

describe('isGoWorkerFormatMessage', () => {
  it('format リクエストを受け付ける', () => {
    expect(isGoWorkerFormatMessage({ type: 'format', reqId: 'r1', code: 'package main' })).toBe(
      true,
    );
  });

  it('code が無いものは拒否する', () => {
    expect(isGoWorkerFormatMessage({ type: 'format', reqId: 'r1' })).toBe(false);
  });
});

describe('isGoWorkerRunMessage', () => {
  it('format リクエストを run と誤認しない', () => {
    expect(isGoWorkerRunMessage({ type: 'format', reqId: 'r1', code: 'x' })).toBe(false);
  });
});

describe('isGoWorkerEvent', () => {
  it('整形成功の formatted イベントを受け付ける', () => {
    expect(
      isGoWorkerEvent({ type: 'formatted', reqId: 'r1', ok: true, code: 'package main\n' }),
    ).toBe(true);
  });

  it('整形失敗の formatted イベントを受け付ける', () => {
    expect(
      isGoWorkerEvent({ type: 'formatted', reqId: 'r1', ok: false, error: '3:12: expected )' }),
    ).toBe(true);
  });

  it('reqId が無い formatted は拒否する', () => {
    expect(isGoWorkerEvent({ type: 'formatted', ok: true, code: 'x' })).toBe(false);
  });

  it('code の型が違う formatted は拒否する', () => {
    expect(isGoWorkerEvent({ type: 'formatted', reqId: 'r1', ok: true, code: 1 })).toBe(false);
  });

  it('fatal 付きの exit イベントを受け付ける', () => {
    expect(
      isGoWorkerEvent({
        type: 'exit',
        runId: 'r1',
        ok: false,
        error: 'Go ランタイムが停止しました',
        ms: 1,
        fatal: true,
      }),
    ).toBe(true);
  });

  it('fatal の型が違う exit は拒否する', () => {
    expect(isGoWorkerEvent({ type: 'exit', runId: 'r1', ok: false, ms: 1, fatal: 'yes' })).toBe(
      false,
    );
  });
});
