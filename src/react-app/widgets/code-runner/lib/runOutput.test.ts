import { appendRunEvent, groupRunOutput, type RunOutputEvent } from './runOutput';

const stdout = (data: string): RunOutputEvent => ({ type: 'stdout', data });
const stderr = (data: string): RunOutputEvent => ({ type: 'stderr', data });

describe('appendRunEvent', () => {
  it('通常のイベントは末尾に足す', () => {
    const items = appendRunEvent([], stdout('Hello\n'));

    expect(items).toEqual([{ type: 'stdout', data: 'Hello\n' }]);
  });

  it('form feed を含む出力はそれ以前を捨てる', () => {
    const items = appendRunEvent([stdout('old\n')], stdout('before\fafter\n'));

    expect(items).toEqual([{ type: 'stdout', data: 'after\n' }]);
  });

  it('複数の form feed は最後より後ろだけ残す', () => {
    const items = appendRunEvent([stdout('old\n')], stderr('a\fb\fc\n'));

    expect(items).toEqual([{ type: 'stderr', data: 'c\n' }]);
  });

  it('form feed で終わる出力は空にする', () => {
    const items = appendRunEvent([stdout('old\n'), stderr('old error\n')], stdout('clear\f'));

    expect(items).toEqual([]);
  });
});

describe('groupRunOutput', () => {
  it('連続するテキストを 1 ブロックにまとめる', () => {
    const blocks = groupRunOutput([stdout('one\n'), stderr('two\n'), stdout('three\n')]);

    expect(blocks).toEqual([
      {
        type: 'text',
        chunks: [
          { type: 'stdout', data: 'one\n' },
          { type: 'stderr', data: 'two\n' },
          { type: 'stdout', data: 'three\n' },
        ],
      },
    ]);
  });

  it('画像を挟むとテキストを分ける', () => {
    const blocks = groupRunOutput([
      stdout('one\n'),
      { type: 'image', dataUrl: 'data:image/png;base64,abc' },
      stdout('two\n'),
    ]);

    expect(blocks).toEqual([
      { type: 'text', chunks: [{ type: 'stdout', data: 'one\n' }] },
      { type: 'image', dataUrl: 'data:image/png;base64,abc' },
      { type: 'text', chunks: [{ type: 'stdout', data: 'two\n' }] },
    ]);
  });

  it('終了状態を順序どおりに並べる', () => {
    const blocks = groupRunOutput([
      stdout('one\n'),
      { type: 'exit', ok: false, error: 'boom', ms: 12 },
    ]);

    expect(blocks).toEqual([
      { type: 'text', chunks: [{ type: 'stdout', data: 'one\n' }] },
      { type: 'exit', ok: false, error: 'boom', ms: 12 },
    ]);
  });
});
