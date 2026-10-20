import type { InlineToken } from './inline.ts';

/**
 * 確認問題（`content/quiz`）の文字列をトークン列に変換する。
 *
 * 確認問題は present 由来ではない手書きのデータなので、present の記法は使わない。
 * present は単語単位でしか記法が効かず `` `0 false` `` のような空白を含むコードを
 * 書けないため、「`` ` `` で囲んだ部分がコード（空白可）、それ以外はテキスト」
 * だけの記法にする。強調・リンクは扱わない。
 *
 * 対になっていない最後の `` ` `` は、それ以降をテキストとして扱う
 * （`scripts/content/validate-quiz.ts` がエラーにするので、表示では落とさない）。
 */
export function parseQuizText(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pushText = (value: string): void => {
    if (value === '') return;
    const last = tokens[tokens.length - 1];
    if (last !== undefined && last.type === 'text') {
      last.value += value;
    } else {
      tokens.push({ type: 'text', value });
    }
  };

  let start = 0;
  for (;;) {
    const open = text.indexOf('`', start);
    if (open === -1) {
      pushText(text.slice(start));
      return tokens;
    }
    const close = text.indexOf('`', open + 1);
    if (close === -1) {
      // 不対のバッククォート自体もテキストに残す。
      pushText(text.slice(start));
      return tokens;
    }
    pushText(text.slice(start, open));
    const code = text.slice(open + 1, close);
    if (code !== '') tokens.push({ type: 'code', value: code });
    start = close + 1;
  }
}

/** バッククォートが奇数個、または空のコードスパン（連続する 2 つの `` ` ``）があるか。 */
export function quizTextProblem(text: string): 'unpaired' | 'empty-code' | undefined {
  const count = text.split('`').length - 1;
  if (count % 2 !== 0) return 'unpaired';
  if (text.includes('``')) return 'empty-code';
  return undefined;
}
