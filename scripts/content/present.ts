/**
 * レッスンの `.article`（present の legacy 形式）を解析する。
 *
 * 参照実装は golang.org/x/tools/present の parse.go / code.go。
 * このリポジトリで使う要素だけを実装する:
 * - ヘッダー（タイトル・サブタイトル）と Author ブロック
 * - `* 見出し` によるセクション（= ページ）
 * - 段落、`- ` 箇条書き、タブ / スペース字下げの pre
 * - `.play`、`.image`
 * - `#` で始まる行のコメント除去（`#appengine` を含む）
 */

export type PresentBlock =
  | { kind: 'text'; lines: string[] }
  | { kind: 'pre'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'play'; file: string; edit: boolean; numbers: boolean; address: string }
  | { kind: 'image'; src: string };

export type PresentPage = {
  title: string;
  blocks: PresentBlock[];
};

export type PresentDoc = {
  title: string;
  subtitle: string;
  authors: string[][];
  pages: PresentPage[];
};

/** present の Lines。`#` で始まる行は読み飛ばす。 */
class Lines {
  index = 0;
  text: string[];

  constructor(text: string[]) {
    this.text = text;
  }

  next(): { text: string; ok: boolean } {
    for (;;) {
      const current = this.index;
      this.index++;
      if (current >= this.text.length) {
        return { text: '', ok: false };
      }
      const line = this.text[current];
      if (!line.startsWith('#')) {
        return { text: line, ok: true };
      }
    }
  }

  back(): void {
    this.index--;
  }

  nextNonEmpty(): { text: string; ok: boolean } {
    for (;;) {
      const result = this.next();
      if (!result.ok || result.text.length > 0) {
        return result;
      }
    }
  }
}

const TOP_LEVEL_HEADING = /^\*( |$)/;
const SUB_LEVEL_HEADING = /^\*\*/;

function isSpeakerNote(line: string): boolean {
  return line.startsWith(': ') || line === ':';
}

/** `Tags:` などのヘッダー行と日付行か。 */
function isHeaderMeta(line: string): boolean {
  return (
    line.startsWith('Tags:') ||
    line.startsWith('Summary:') ||
    line.startsWith('OldURL:') ||
    /^\d{2}:\d{2} \d{1,2} \S+ \d{4}$/.test(line) ||
    /^\d{1,2} \S+ \d{4}$/.test(line)
  );
}

export function parseArticle(source: string): PresentDoc {
  const lines = new Lines(source.split(/\r?\n/));
  const doc: PresentDoc = {
    title: '',
    subtitle: '',
    authors: [],
    pages: [],
  };

  // ヘッダー: 最初の非空行がタイトル。空行までがサブタイトルなどのメタ情報。
  const titleLine = lines.nextNonEmpty();
  if (!titleLine.ok) {
    throw new Error('unexpected EOF: expected title');
  }
  doc.title = titleLine.text;

  for (;;) {
    const headerLine = lines.next();
    if (!headerLine.ok) {
      throw new Error('unexpected EOF in header');
    }
    if (headerLine.text === '') {
      break;
    }
    if (isSpeakerNote(headerLine.text) || isHeaderMeta(headerLine.text)) {
      continue;
    }
    if (doc.subtitle === '') {
      doc.subtitle = headerLine.text;
      continue;
    }
    throw new Error(`unexpected header line: ${JSON.stringify(headerLine.text)}`);
  }

  doc.authors = parseAuthors(lines);
  doc.pages = parseSections(lines);
  return doc;
}

function parseAuthors(lines: Lines): string[][] {
  const authors: string[][] = [];
  const start = lines.nextNonEmpty();
  if (!start.ok) {
    return authors;
  }
  lines.back();

  let current: string[] | null = null;
  for (;;) {
    const line = lines.next();
    if (!line.ok) {
      break;
    }
    if (TOP_LEVEL_HEADING.test(line.text)) {
      lines.back();
      break;
    }
    if (isSpeakerNote(line.text)) {
      continue;
    }
    if (current !== null && line.text === '') {
      authors.push(current);
      current = null;
      continue;
    }
    if (current === null) {
      current = [];
    }
    current.push(line.text);
  }
  if (current !== null) {
    authors.push(current);
  }
  return authors;
}

function parseSections(lines: Lines): PresentPage[] {
  const pages: PresentPage[] = [];

  for (;;) {
    const heading = lines.nextNonEmpty();
    if (!heading.ok) {
      break;
    }
    if (!TOP_LEVEL_HEADING.test(heading.text)) {
      throw new Error(`unexpected line: ${JSON.stringify(heading.text)}`);
    }
    if (SUB_LEVEL_HEADING.test(heading.text)) {
      throw new Error(`nested sections are not supported: ${heading.text}`);
    }

    const page: PresentPage = {
      title: heading.text.slice(1).trim(),
      blocks: [],
    };

    let current = lines.nextNonEmpty();
    while (current.ok) {
      const text = current.text;
      if (TOP_LEVEL_HEADING.test(text)) {
        lines.back();
        break;
      }
      if (SUB_LEVEL_HEADING.test(text)) {
        throw new Error(`nested sections are not supported: ${text}`);
      }

      if (/^\s/.test(text)) {
        page.blocks.push(parsePre(lines, text));
      } else if (text.startsWith('- ')) {
        page.blocks.push(parseList(lines, text));
      } else if (text.startsWith('.')) {
        page.blocks.push(parseDirective(text));
      } else if (isSpeakerNote(text)) {
        // presenter notes は捨てる（present も既定では表示しない）。
      } else {
        page.blocks.push(parseParagraph(lines, text));
      }

      current = lines.nextNonEmpty();
    }

    pages.push(page);
  }

  if (pages.length === 0) {
    throw new Error('no sections found');
  }
  return pages;
}

function parsePre(lines: Lines, firstLine: string): PresentBlock {
  const indent = firstLine.match(/^[ \t]*/)?.[0] ?? '';
  const collected: string[] = [];
  let current: { text: string; ok: boolean } = { text: firstLine, ok: true };

  while (current.ok && (current.text === '' || current.text.startsWith(indent))) {
    collected.push(current.text === '' ? '' : current.text.slice(indent.length));
    current = lines.next();
  }
  lines.back();

  // present はタブを 4 スペースにし、ブロック全体の右側の空白だけを落とす。
  const raw = collected.join('\n').replace(/\t/g, '    ');
  return { kind: 'pre', text: raw.replace(/\s+$/u, '') };
}

function parseList(lines: Lines, firstLine: string): PresentBlock {
  const items: string[] = [];
  let current: { text: string; ok: boolean } = { text: firstLine, ok: true };

  for (;;) {
    if (current.text.startsWith('- ')) {
      items.push(current.text.slice(2));
    } else if (items.length > 0 && current.text.startsWith(' ')) {
      // 折り返された項目。present は "\n" で連結するが、HTML では空白になるので
      // ここでは読みやすいようにスペースで連結する。
      items[items.length - 1] += ` ${current.text.trim()}`;
    } else {
      break;
    }
    current = lines.next();
    if (!current.ok) {
      break;
    }
  }
  lines.back();
  return { kind: 'list', items };
}

function parseParagraph(lines: Lines, firstLine: string): PresentBlock {
  const block: string[] = [];
  let current: { text: string; ok: boolean } = { text: firstLine, ok: true };

  while (current.ok && current.text.trim() !== '') {
    if (
      current.text.startsWith('.') ||
      isSpeakerNote(current.text) ||
      TOP_LEVEL_HEADING.test(current.text)
    ) {
      lines.back();
      break;
    }
    let line = current.text;
    if (line.startsWith('\\.')) {
      line = line.slice(1);
    }
    block.push(line);
    current = lines.next();
  }
  if (block.length === 0) {
    throw new Error('empty paragraph');
  }
  return { kind: 'text', lines: block };
}

function parseDirective(line: string): PresentBlock {
  if (line.startsWith('.play')) {
    return parsePlay(line);
  }
  if (line.startsWith('.image')) {
    return parseImage(line);
  }
  throw new Error(`unknown present directive: ${JSON.stringify(line)}`);
}

const CODE_DIRECTIVE = /^\.(?:play|code)\s+((?:(?:-edit|-numbers)\s+)*)([^\s]+)(?:\s+(.*))?$/;

function parsePlay(line: string): PresentBlock {
  // present は末尾の "HLxxx" をフラグとして切り離す。現在のコンテンツには無いが、
  // 付いていてもファイル名として誤解しないようにする。
  let command = line.trim();
  const highlight = /\s+HL[a-zA-Z0-9_]*$/.exec(command);
  if (highlight !== null) {
    command = command.slice(0, highlight.index);
  }
  if (!command.startsWith('.play')) {
    throw new Error(`.code is not supported (only .play): ${JSON.stringify(line)}`);
  }

  const match = CODE_DIRECTIVE.exec(command);
  if (match === null) {
    throw new Error(`syntax error for .play invocation: ${JSON.stringify(line)}`);
  }
  const [, flags, file, rest] = match;
  return {
    kind: 'play',
    file,
    edit: flags.includes('-edit'),
    numbers: flags.includes('-numbers'),
    address: (rest ?? '').trim(),
  };
}

function parseImage(line: string): PresentBlock {
  const args = line.trim().split(/\s+/);
  if (args.length < 2) {
    throw new Error(`incorrect .image invocation: ${JSON.stringify(line)}`);
  }
  return { kind: 'image', src: args[1] };
}
