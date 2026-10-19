/**
 * present のインライン記法（`style.go` の `font` / `split` / `parseInlineLink`）を
 * トークン列に変換する。
 *
 * 記法は空白区切りの「単語」単位で効き、マーカー（`` ` `` / `_` / `*`）で囲まれた
 * 単語の内側にある同じマーカーは空白として扱う。例:
 *
 * - `` `package`rand` `` → `package rand`
 * - `` `IPAddr{1,`2,`3,`4}` `` → `IPAddr{1, 2, 3, 4}`
 * - `*Another*note:*` → `Another note:`
 *
 * 日本語訳でも使えるように、次の拡張を入れる。英語原文には和文が現れないため、
 * 英語の解釈は変わらない。
 *
 * - マーカーの前後が和文（漢字・ひらがな・カタカナ）でも区切りとして認める
 * - 和文を含む文では、和文の句読点・括弧も単語の区切りにする（`int`、`uint` の
 *   ように句読点だけで並んだコードが 1 つのコードに融合しないようにする）
 * - 和文を含む文では、リンクの直後の単語を遅延せずに分割する（present では
 *   `[[link]]では、`code`` の後続コードが直前の単語と融合してしまう）
 *
 * Node の type stripping で読めるように、型だけの import と拡張子付き import を使い、
 * enum / namespace は使わない。
 */

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'em'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'link'; url: string; label: InlineToken[] };

type InlineLink = {
  url: string;
  /** 表示するラベル。ラベルが空なら URL を表示する（present の renderLink と同じ）。 */
  label: string;
  /** ラベルをインライン記法として解釈するか。URL をそのまま表示する場合は false。 */
  styled: boolean;
  /** `[[` から `]]` までの長さ。 */
  length: number;
};

const MARKERS = '_*`';
/**
 * present は HTML エスケープ後の文字列を解析する。`<` `>` `"` はエスケープされて
 * URL に現れないので、生の入力では禁止しない（present の badURLChars から除外）。
 */
const LINK_BAD_URL_CHARS = /[`{}|\\^[\] ]/u;
const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/u;
const INVALID_PERCENT = /%(?![0-9A-Fa-f]{2})/u;
const PUNCTUATION = /^\p{P}$/u;
/**
 * 和文の文字。present の `unicode.IsPunct` に加えて、マーカーの前後の区切りとして
 * 認める。Script_Extensions なので「ー」「々」のような共通文字も含む。
 * ラテン文字は含めない（英語原文の解釈を変えないため）。
 */
const JAPANESE_LETTER =
  /^[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]$/u;
/**
 * 和文の句読点・括弧。present の単語分割は空白だけを区切りにするため、
 * `int`、`uint` のように句読点だけで並んだコードが 1 つの単語に融合してしまう。
 * 和文を含む文ではこれらも単語の区切りとして扱う（英語原文の解釈は変えない）。
 * `\p{P}` と組み合わせるので、同じ範囲にある「々」のような文字は区切りにしない。
 */
const JAPANESE_PUNCTUATION_RANGE =
  /^[\u3000-\u303F\u30FB\uFE10-\uFE19\uFE30-\uFE4F\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65]$/u;

function isInlineBoundary(char: string): boolean {
  return PUNCTUATION.test(char) || JAPANESE_LETTER.test(char);
}

/** 和文を含む文か。和文向けの単語分割を使うかの判定に使う。 */
function hasJapaneseText(text: string): boolean {
  for (const char of text) {
    if (JAPANESE_LETTER.test(char) || JAPANESE_PUNCTUATION_RANGE.test(char)) {
      return true;
    }
  }
  return false;
}

/** Go の unicode.IsSpace と同じ集合。 */
function isUnicodeSpace(char: string): boolean {
  return /^[\t\n\v\f\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]$/u.test(char);
}

/** Go の strings.IndexAny(s, chars) 相当。 */
function indexOfAny(s: string, chars: string): number {
  for (let index = 0; index < s.length; index++) {
    if (chars.includes(s[index])) {
      return index;
    }
  }
  return -1;
}

/** 文字列をコードポイント単位に分ける（絵文字などを壊さない）。 */
function codePoints(text: string): string[] {
  const chars: string[] = [];
  for (const char of text) {
    chars.push(char);
  }
  return chars;
}

function hasBadUrlChars(url: string): boolean {
  return LINK_BAD_URL_CHARS.test(url);
}

/**
 * `[[url]]` / `[[url][label]]` を先頭から解析する。
 * present の `parseInlineLink` と同じく、URL に使えない文字が含まれる場合は null。
 */
function parseInlineLinkAt(s: string): InlineLink | null {
  if (!s.startsWith('[[')) {
    return null;
  }
  const end = s.indexOf(']]');
  if (end < 0) {
    return null;
  }
  const urlEnd = s.indexOf(']');
  // `]]` が見つかっているので urlEnd も必ず見つかる。
  const rawUrl = s.slice(2, urlEnd);
  if (hasBadUrlChars(rawUrl)) {
    return null;
  }
  const length = end + 2;

  if (urlEnd === end) {
    // `[[url]]`。present は scheme を落として表示する。落とせない場合は URL 全体。
    const simpleUrl = stripScheme(rawUrl);
    if (simpleUrl === '') {
      return { url: rawUrl, label: rawUrl, styled: false, length };
    }
    return { url: rawUrl, label: simpleUrl, styled: true, length };
  }
  if (s.slice(urlEnd, urlEnd + 2) !== '][') {
    return null;
  }

  const label = s.slice(urlEnd + 2, end);
  if (label === '') {
    return { url: rawUrl, label: rawUrl, styled: false, length };
  }
  return { url: rawUrl, label, styled: true, length };
}

/** present の `parseInlineLink` が `url.Parse` で scheme を落とす挙動を写す。 */
function stripScheme(url: string): string {
  const match = SCHEME.exec(url);
  // url.Parse がエラーになる URL（不正な % エスケープ）は scheme を落とさない。
  if (match === null || INVALID_PERCENT.test(url)) {
    return '';
  }
  const scheme = match[1];
  if (url.startsWith(`${scheme}://`)) {
    return url.slice(scheme.length + '://'.length);
  }
  return url.slice(scheme.length + ':'.length);
}

/**
 * present の `split` を写す。空白の連なりも 1 つの「単語」として返し、
 * `[[...]]` はラベル内の空白ごと独立した単語にする。
 */
function splitInlinePresent(s: string): string[] {
  const words: string[] = [];
  let start = 0;

  const appendWord = (end: number): void => {
    const j = s.slice(start, end).indexOf('[[');
    if (j > -1) {
      const link = parseInlineLinkAt(s.slice(start + j));
      if (link !== null) {
        if (j > 0) {
          words.push(s.slice(start, start + j));
        }
        words.push(s.slice(start + j, start + j + link.length));
        start = start + j + link.length;
        return;
      }
    }
    words.push(s.slice(start, end));
    start = end;
  };

  let wasSpace = false;
  let offset = 0;
  for (const char of s) {
    const isSpace = isUnicodeSpace(char);
    if (offset > start && isSpace !== wasSpace) {
      appendWord(offset);
    }
    wasSpace = isSpace;
    offset += char.length;
  }
  while (start < s.length) {
    appendWord(s.length);
  }
  return words;
}

function isJapaneseSeparator(char: string): boolean {
  return isUnicodeSpace(char) || (PUNCTUATION.test(char) && JAPANESE_PUNCTUATION_RANGE.test(char));
}

/** 区切り文字の連なりを 1 単語として切り出す。 */
function pushRunWords(words: string[], range: string): void {
  if (range === '') {
    return;
  }
  let start = 0;
  let offset = 0;
  let wasSeparator: boolean | null = null;
  for (const char of range) {
    const separator = isJapaneseSeparator(char);
    if (wasSeparator !== null && separator !== wasSeparator) {
      words.push(range.slice(start, offset));
      start = offset;
    }
    wasSeparator = separator;
    offset += char.length;
  }
  words.push(range.slice(start));
}

function findInlineLink(s: string, from: number): { start: number; length: number } | null {
  let search = from;
  for (;;) {
    const start = s.indexOf('[[', search);
    if (start < 0) {
      return null;
    }
    const link = parseInlineLinkAt(s.slice(start));
    if (link !== null) {
      return { start, length: link.length };
    }
    search = start + 2;
  }
}

/**
 * 和文向けの `split`。present と同じくリンクを独立した単語にしつつ、
 * 和文の句読点・括弧も単語の区切りにする。present はリンクの直後の単語を
 * 遅延して処理するため、`[[link]]では、`code`` のような並びで後続のコードが
 * 1 単語に融合するが、こちらではリンクの前後を正しく分ける。
 */
function splitInlineJapanese(s: string): string[] {
  const words: string[] = [];
  let index = 0;
  for (;;) {
    const link = findInlineLink(s, index);
    if (link === null) {
      pushRunWords(words, s.slice(index));
      return words;
    }
    pushRunWords(words, s.slice(index, link.start));
    words.push(s.slice(link.start, link.start + link.length));
    index = link.start + link.length;
  }
}

function tokenForMarker(marker: string, value: string): InlineToken | null {
  switch (marker) {
    case '`':
      return { type: 'code', value };
    case '_':
      return { type: 'em', value };
    case '*':
      return { type: 'strong', value };
    default:
      return null;
  }
}

/** マーカーで囲まれた 1 単語を解析する。present の `font` の 1 単語分。 */
function parseWord(word: string): InlineToken[] {
  if (word.length === 0) {
    return [];
  }

  const link = parseInlineLinkAt(word);
  if (link !== null) {
    return [
      {
        type: 'link',
        url: link.url,
        label: link.styled ? parseInline(link.label) : [{ type: 'text', value: link.label }],
      },
    ];
  }

  if (word.length < 2) {
    return [{ type: 'text', value: word }];
  }

  const first = indexOfAny(word, MARKERS);
  if (first < 0) {
    return [{ type: 'text', value: word }];
  }

  // 開始マーカーは単語の先頭か、句読点・和文の直後にある必要がある。
  if (first !== 0) {
    const beforeChars = codePoints(word.slice(0, first));
    const before = beforeChars[beforeChars.length - 1] ?? '';
    if (!isInlineBoundary(before)) {
      return [{ type: 'text', value: word }];
    }
  }

  const marker = word[first];
  const rest = word.slice(first);
  const last = rest.lastIndexOf(marker);
  if (last === 0) {
    return [{ type: 'text', value: word }];
  }
  // 終了マーカーは単語の末尾か、句読点・和文の直前にある必要がある。
  if (last + 1 !== rest.length) {
    const after = String.fromCodePoint(rest.codePointAt(last + 1) ?? 0);
    if (!isInlineBoundary(after)) {
      return [{ type: 'text', value: word }];
    }
  }

  const open = word.slice(0, first);
  const head = rest.slice(0, last + 1);
  const tail = rest.slice(last + 1);
  const chars = codePoints(head);
  let value = '';
  let index = 1;
  while (index < chars.length - 1) {
    const char = chars[index];
    if (char !== marker) {
      value += char;
      index++;
      continue;
    }
    if (chars[index + 1] === marker) {
      // 2 つ続いたマーカーは本物の文字。
      value += marker;
      index += 2;
      continue;
    }
    // 内側のマーカーは空白になる。
    value += ' ';
    index++;
  }

  const styled = tokenForMarker(marker, value);
  if (styled === null) {
    return [{ type: 'text', value: word }];
  }
  const tokens: InlineToken[] = [];
  if (open !== '') {
    tokens.push({ type: 'text', value: open });
  }
  tokens.push(styled);
  if (tail !== '') {
    tokens.push({ type: 'text', value: tail });
  }
  return tokens;
}

function mergeTextTokens(tokens: InlineToken[]): InlineToken[] {
  const merged: InlineToken[] = [];
  for (const token of tokens) {
    const previous = merged[merged.length - 1];
    if (token.type === 'text' && previous?.type === 'text') {
      merged[merged.length - 1] = { type: 'text', value: previous.value + token.value };
    } else {
      merged.push(token);
    }
  }
  return merged;
}

/**
 * present のインライン記法をトークン列にする。
 * マーカーやリンクが見つからない部分は text トークンになる。
 */
export function parseInline(text: string): InlineToken[] {
  if (text === '') {
    return [];
  }
  if (!/[`_*[]/u.test(text)) {
    return [{ type: 'text', value: text }];
  }
  const words = hasJapaneseText(text) ? splitInlineJapanese(text) : splitInlinePresent(text);
  return mergeTextTokens(words.flatMap(parseWord));
}

/** トークン列の表示テキスト（HTML タグを除いたもの）を返す。 */
export function inlineText(tokens: InlineToken[]): string {
  let text = '';
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
      case 'code':
      case 'em':
      case 'strong':
        text += token.value;
        break;
      case 'link':
        text += inlineText(token.label);
        break;
    }
  }
  return text;
}

/** コードトークンの中身を出現順に返す。リンクのラベル内も含む。 */
export function inlineCodeValues(text: string): string[] {
  const values: string[] = [];
  const visit = (tokens: InlineToken[]): void => {
    for (const token of tokens) {
      if (token.type === 'code') {
        values.push(token.value);
      } else if (token.type === 'link') {
        visit(token.label);
      }
    }
  };
  visit(parseInline(text));
  return values;
}

/** リンクの URL を出現順に返す。 */
export function inlineUrlValues(text: string): string[] {
  const urls: string[] = [];
  const visit = (tokens: InlineToken[]): void => {
    for (const token of tokens) {
      if (token.type === 'link') {
        urls.push(token.url);
        visit(token.label);
      }
    }
  };
  visit(parseInline(text));
  return urls;
}
