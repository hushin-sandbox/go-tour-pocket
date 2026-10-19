/**
 * 実行イベントを画面表示用に整える。
 *
 * - `^L`（U+000C、form feed）が出力に含まれたら、それ以前の出力を捨てる
 *   （Go の playground と同じ「画面クリア」の扱い）
 * - 連続する stdout / stderr は 1 つのテキストブロックにまとめ、画像や終了状態の
 *   間でだけ改行を入れる
 *
 * DOM に依存しないので Workers runtime のテストからも使える。
 * shared/lib の GoRunEvent と同じ形の最小の型をここに置き、テストから
 * goRunner（DOM 前提）を型解決で巻き込まないようにしている。
 */

export type RunOutputEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'image'; dataUrl: string }
  | { type: 'exit'; ok: boolean; error?: string; ms: number };

export type RunOutputBlock =
  | { type: 'text'; chunks: { type: 'stdout' | 'stderr'; data: string }[] }
  | { type: 'image'; dataUrl: string }
  | { type: 'exit'; ok: boolean; error?: string; ms: number };

/** 1 イベントを出力一覧に反映する。form feed を含む場合はそれ以前を捨てる。 */
export function appendRunEvent(items: RunOutputEvent[], event: RunOutputEvent): RunOutputEvent[] {
  if (event.type !== 'stdout' && event.type !== 'stderr') {
    return [...items, event];
  }
  const clearAt = event.data.lastIndexOf('\f');
  if (clearAt === -1) return [...items, event];

  const rest = event.data.slice(clearAt + 1);
  return rest.length === 0 ? [] : [{ ...event, data: rest }];
}

/** 連続するテキストをまとめ、画像・終了状態を順序どおりに並べる。 */
export function groupRunOutput(items: RunOutputEvent[]): RunOutputBlock[] {
  const blocks: RunOutputBlock[] = [];
  for (const item of items) {
    if (item.type === 'stdout' || item.type === 'stderr') {
      const last = blocks[blocks.length - 1];
      if (last !== undefined && last.type === 'text') {
        last.chunks.push({ type: item.type, data: item.data });
      } else {
        blocks.push({ type: 'text', chunks: [{ type: item.type, data: item.data }] });
      }
      continue;
    }
    if (item.type === 'image') {
      blocks.push({ type: 'image', dataUrl: item.dataUrl });
      continue;
    }
    blocks.push({ type: 'exit', ok: item.ok, error: item.error, ms: item.ms });
  }
  return blocks;
}
