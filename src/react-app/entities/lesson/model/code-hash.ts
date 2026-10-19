/**
 * 原文コードの hash。編集中コードを localStorage に保存するときのキーに使う。
 *
 * content の block hash は scripts/content の SHA-1 だが、ブラウザから同期で
 * SHA-1 を計算する手段がないため、ここでは FNV-1a（64bit）を 12 桁の hex に
 * 切り出して使う。原文が変わったらキーが変わり、古い編集内容を捨てられる。
 */
export function codeHash(code: string): string {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < code.length; index += 1) {
    hash ^= BigInt(code.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0').slice(0, 12);
}
