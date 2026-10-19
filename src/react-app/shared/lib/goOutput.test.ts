import { GoOutputSplitter } from './goOutput';

describe('GoOutputSplitter', () => {
  it('改行ごとに stdout の行を切り出す', () => {
    const splitter = new GoOutputSplitter();
    expect(splitter.push('stdout', 'Hello\n世界\n')).toEqual([
      { type: 'stdout', data: 'Hello\n' },
      { type: 'stdout', data: '世界\n' },
    ]);
    expect(splitter.flush('stdout')).toBeUndefined();
  });

  it('行の途中で切れたチャンクをバッファリングする', () => {
    const splitter = new GoOutputSplitter();
    expect(splitter.push('stdout', 'Hel')).toEqual([]);
    expect(splitter.push('stdout', 'lo\n')).toEqual([{ type: 'stdout', data: 'Hello\n' }]);
  });

  it('IMAGE: 行を data URL に変換する', () => {
    const splitter = new GoOutputSplitter();
    expect(splitter.push('stdout', 'IMAGE:aGVsbG8=\n')).toEqual([
      { type: 'image', dataUrl: 'data:image/png;base64,aGVsbG8=' },
    ]);
  });

  it('IMAGE: が stderr に来ても文字列として扱う', () => {
    const splitter = new GoOutputSplitter();
    expect(splitter.push('stderr', 'IMAGE:aGVsbG8=\n')).toEqual([
      { type: 'stderr', data: 'IMAGE:aGVsbG8=\n' },
    ]);
  });

  it('改行で終わらない最後の行は flush で取り出せる', () => {
    const splitter = new GoOutputSplitter();
    expect(splitter.push('stderr', 'error: ')).toEqual([]);
    expect(splitter.flush('stderr')).toEqual({ type: 'stderr', data: 'error: ' });
    expect(splitter.flush('stderr')).toBeUndefined();
  });

  it('IMAGE: が途中で切れたまま終わっても画像にしない', () => {
    const splitter = new GoOutputSplitter();
    expect(splitter.push('stdout', 'IMAGE:aGVs')).toEqual([]);
    expect(splitter.flush('stdout')).toEqual({ type: 'stdout', data: 'IMAGE:aGVs' });
  });
});
