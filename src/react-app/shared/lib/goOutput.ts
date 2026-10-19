/**
 * Worker が受け取った stdout / stderr のチャンクを行に分割する。
 *
 * `pic.ShowImage` は "IMAGE:<base64>" という 1 行を出力するため、行が確定してから
 * 画像かどうかを判定する。行が途中のチャンクは Worker 内でバッファリングする。
 * DOM に依存しないので Worker の外（テスト）からも使える。
 */

export type GoOutputChunk =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'image'; dataUrl: string };

const IMAGE_PREFIX = 'IMAGE:';

export class GoOutputSplitter {
  private readonly buffers: Record<'stdout' | 'stderr', string> = { stdout: '', stderr: '' };

  push(kind: 'stdout' | 'stderr', data: string): GoOutputChunk[] {
    let remaining = this.buffers[kind] + data;
    const chunks: GoOutputChunk[] = [];
    for (;;) {
      const newline = remaining.indexOf('\n');
      if (newline === -1) break;
      const line = remaining.slice(0, newline);
      remaining = remaining.slice(newline + 1);
      chunks.push(lineToChunk(kind, line));
    }
    this.buffers[kind] = remaining;
    return chunks;
  }

  /** 改行で終わらない最後のチャンクを実行終了時に取り出す */
  flush(kind: 'stdout' | 'stderr'): GoOutputChunk | undefined {
    const buffer = this.buffers[kind];
    this.buffers[kind] = '';
    if (buffer.length === 0) return undefined;
    return { type: kind, data: buffer };
  }
}

function lineToChunk(kind: 'stdout' | 'stderr', line: string): GoOutputChunk {
  if (kind === 'stdout' && line.startsWith(IMAGE_PREFIX)) {
    return {
      type: 'image',
      dataUrl: `data:image/png;base64,${line.slice(IMAGE_PREFIX.length).trim()}`,
    };
  }
  return { type: kind, data: `${line}\n` };
}
