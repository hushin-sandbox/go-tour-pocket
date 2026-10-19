import { createHash } from 'node:crypto';

/** 原文テキストの SHA-1（先頭 12 桁）。 */
export function contentHash(text: string): string {
  return createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 12);
}

/**
 * list ブロックの hash。項目を改行で連結したものを原文テキストとみなす。
 * p ブロックは text そのもの。
 */
export function listHash(items: string[]): string {
  return contentHash(items.join('\n'));
}
