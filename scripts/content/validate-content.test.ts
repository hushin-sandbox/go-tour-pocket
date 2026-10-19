import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ListBlock, Lesson, LessonJa, ParagraphBlock } from '../../src/shared/content.ts';
import { contentHash, listHash } from './hash.ts';
import { CONTENT_EN_DIR } from './paths.ts';
import {
  inlineCodeSpans,
  inlineUrls,
  validateContent,
  validateLesson,
} from './validate-content.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const paragraphText = 'Use `fmt` and [[/doc/][the docs]].';
const listItems = ['first `x`', 'second'];

function makeLesson(): Lesson {
  const paragraph: ParagraphBlock = {
    id: 'basics/0/0',
    hash: contentHash(paragraphText),
    kind: 'p',
    text: paragraphText,
  };
  const list: ListBlock = {
    id: 'basics/0/1',
    hash: listHash(listItems),
    kind: 'list',
    items: listItems,
  };
  return {
    id: 'basics',
    title: 'Basics',
    description: 'Description',
    pages: [
      {
        title: 'Page',
        blocks: [paragraph, list, { id: 'basics/0/2', kind: 'pre', text: 'code' }],
      },
    ],
  };
}

function makeJa(lesson: Lesson): LessonJa {
  const paragraph = lesson.pages[0].blocks[0];
  const list = lesson.pages[0].blocks[1];
  if (paragraph.kind !== 'p' || list.kind !== 'list') {
    throw new Error('unexpected fixture');
  }
  return {
    id: 'basics',
    title: '基礎',
    description: '説明',
    pages: [
      {
        title: 'ページ',
        blocks: {
          [paragraph.id]: {
            hash: paragraph.hash,
            text: '`fmt` と [[/doc/][ドキュメント]] を使います。',
          },
          [list.id]: {
            hash: list.hash,
            items: ['最初の `x`', '2 番目'],
          },
        },
      },
    ],
  };
}

function errorsOf(lesson: Lesson, ja: LessonJa | null): string[] {
  return validateLesson(lesson, ja)
    .filter((issue) => issue.level === 'error')
    .map((issue) => issue.message);
}

describe('inline extractors', () => {
  it('extracts code spans and URLs', () => {
    expect(inlineCodeSpans('a `b` c `d`')).toEqual(['b', 'd']);
    expect(inlineCodeSpans('`unclosed')).toEqual([]);
    expect(inlineUrls('[[/a][A]] and [[https://x][X]]')).toEqual(['/a', 'https://x']);
  });
});

describe('validateLesson', () => {
  it('accepts a complete translation', () => {
    const lesson = makeLesson();
    expect(errorsOf(lesson, makeJa(lesson))).toEqual([]);
  });

  it('warns when ja is missing but does not error', () => {
    const lesson = makeLesson();
    const issues = validateLesson(lesson, null);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warning');
    expect(issues[0].message).toMatch(/translation not found/);
  });

  it('detects a hash mismatch', () => {
    const lesson = makeLesson();
    const ja = makeJa(lesson);
    ja.pages[0].blocks['basics/0/0'].hash = '000000000000';
    expect(errorsOf(lesson, ja).join('\n')).toMatch(/hash mismatch/);
  });

  it('detects a stale english hash', () => {
    const lesson = makeLesson();
    const block = lesson.pages[0].blocks[0];
    if (block.kind !== 'p') {
      throw new Error('fixture is not a paragraph');
    }
    block.hash = '000000000000';
    expect(errorsOf(lesson, makeJa(lesson)).join('\n')).toMatch(/english hash is stale/);
  });

  it('detects a list item count mismatch', () => {
    const lesson = makeLesson();
    const ja = makeJa(lesson);
    ja.pages[0].blocks['basics/0/1'].items = ['最初の `x`'];
    expect(errorsOf(lesson, ja).join('\n')).toMatch(/item count mismatch/);
  });

  it('detects inline code differences', () => {
    const lesson = makeLesson();
    const ja = makeJa(lesson);
    ja.pages[0].blocks['basics/0/0'].text = 'fmt と [[/doc/][ドキュメント]] を使います。';
    expect(errorsOf(lesson, ja).join('\n')).toMatch(/inline code does not match/);
  });

  it('detects URL differences', () => {
    const lesson = makeLesson();
    const ja = makeJa(lesson);
    ja.pages[0].blocks['basics/0/0'].text = '`fmt` と [[/other/][ドキュメント]] を使います。';
    expect(errorsOf(lesson, ja).join('\n')).toMatch(/URLs do not match/);
  });

  it('detects a missing block translation', () => {
    const lesson = makeLesson();
    const ja = makeJa(lesson);
    delete ja.pages[0].blocks['basics/0/1'];
    expect(errorsOf(lesson, ja).join('\n')).toMatch(/missing list translation/);
  });

  it('detects a translated pre block', () => {
    const lesson = makeLesson();
    const ja = makeJa(lesson);
    ja.pages[0].blocks['basics/0/2'] = { hash: 'whatever', text: 'コード' };
    expect(errorsOf(lesson, ja).join('\n')).toMatch(/pre block must not be translated/);
  });

  it('detects an unknown ja block id', () => {
    const lesson = makeLesson();
    const ja = makeJa(lesson);
    ja.pages[0].blocks['basics/0/99'] = { hash: 'whatever', text: '余分' };
    expect(errorsOf(lesson, ja).join('\n')).toMatch(/unknown block id/);
  });

  it('detects a page count mismatch', () => {
    const lesson = makeLesson();
    const ja = makeJa(lesson);
    ja.pages.push({ title: '余分', blocks: {} });
    expect(errorsOf(lesson, ja).join('\n')).toMatch(/page count mismatch/);
  });
});

describe('validateContent', () => {
  it('reports missing ja lessons as warnings only', () => {
    const emptyJaDir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-tour-ja-'));
    tempDirs.push(emptyJaDir);

    const result = validateContent({ enDir: CONTENT_EN_DIR, jaDir: emptyJaDir });

    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(7);
    expect(result.missingLessons).toEqual([
      'welcome',
      'basics',
      'flowcontrol',
      'moretypes',
      'methods',
      'generics',
      'concurrency',
    ]);
  });
});
