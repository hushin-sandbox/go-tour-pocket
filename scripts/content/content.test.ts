import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LESSON_IDS } from '../../src/shared/content.ts';
import type { ContentLessonId, Lesson, LessonIndex } from '../../src/shared/content.ts';
import { contentHash, listHash } from './hash.ts';
import { ROOT_DIR } from './paths.ts';

const EN_DIR = path.join(ROOT_DIR, 'content', 'en');

type Expected = {
  pages: number;
  code: number;
  p: number;
  list: number;
  pre: number;
  image: number;
};

const EXPECTED: Record<ContentLessonId, Expected> = {
  welcome: { pages: 3, code: 1, p: 14, list: 3, pre: 0, image: 0 },
  basics: { pages: 17, code: 16, p: 53, list: 1, pre: 8, image: 0 },
  flowcontrol: { pages: 14, code: 13, p: 34, list: 1, pre: 3, image: 0 },
  moretypes: { pages: 27, code: 26, p: 78, list: 0, pre: 20, image: 0 },
  methods: { pages: 26, code: 25, p: 95, list: 0, pre: 16, image: 0 },
  generics: { pages: 3, code: 2, p: 8, list: 0, pre: 1, image: 0 },
  concurrency: { pages: 11, code: 9, p: 51, list: 1, pre: 9, image: 1 },
};

function readLesson(id: ContentLessonId): Lesson {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 生成物を読み込むテスト
  return JSON.parse(fs.readFileSync(path.join(EN_DIR, `${id}.json`), 'utf8')) as Lesson;
}

function readIndex(): LessonIndex {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 生成物を読み込むテスト
  return JSON.parse(fs.readFileSync(path.join(EN_DIR, 'index.json'), 'utf8')) as LessonIndex;
}

function isContentLessonId(value: string): value is ContentLessonId {
  const ids: readonly string[] = LESSON_IDS;
  return ids.includes(value);
}

describe('generated content/en', () => {
  it('has the expected pages and blocks per lesson', () => {
    const total = { pages: 0, code: 0, p: 0, list: 0, pre: 0, image: 0 };
    for (const id of LESSON_IDS) {
      const lesson = readLesson(id);
      const counts = { pages: lesson.pages.length, code: 0, p: 0, list: 0, pre: 0, image: 0 };
      for (const page of lesson.pages) {
        if (page.code !== undefined) {
          counts.code++;
        }
        for (const block of page.blocks) {
          counts[block.kind]++;
        }
      }

      expect({ id, ...counts }).toEqual({ id, ...EXPECTED[id] });
      expect(lesson.id).toBe(id);
      expect(lesson.title.length).toBeGreaterThan(0);
      expect(lesson.description.length).toBeGreaterThan(0);
      for (const key of ['pages', 'code', 'p', 'list', 'pre', 'image'] as const) {
        total[key] += counts[key];
      }
    }

    expect(total).toEqual({ pages: 101, code: 92, p: 333, list: 6, pre: 57, image: 1 });
  });

  it('has stable ids, hashes and no leftover present comments', () => {
    const ids = new Set<string>();
    let translationBlocks = 0;
    let translationCharacters = 0;

    for (const lessonId of LESSON_IDS) {
      const lesson = readLesson(lessonId);
      for (const [pageIndex, page] of lesson.pages.entries()) {
        for (const [blockIndex, block] of page.blocks.entries()) {
          expect(block.id).toBe(`${lessonId}/${pageIndex}/${blockIndex}`);
          expect(ids.has(block.id)).toBe(false);
          ids.add(block.id);

          if (block.kind === 'p') {
            expect(block.hash).toMatch(/^[0-9a-f]{12}$/);
            expect(block.hash).toBe(contentHash(block.text));
            expect(block.text).not.toMatch(/#appengine/);
            translationBlocks++;
            translationCharacters += block.text.length;
          } else if (block.kind === 'list') {
            expect(block.hash).toMatch(/^[0-9a-f]{12}$/);
            expect(block.hash).toBe(listHash(block.items));
            for (const item of block.items) {
              expect(item).not.toMatch(/#appengine/);
              translationCharacters += item.length;
            }
            translationBlocks++;
          } else if (block.kind === 'pre') {
            expect(block.text).not.toMatch(/#appengine/);
          }
        }

        if (page.code !== undefined) {
          expect(page.code.name).not.toBe('');
          expect(page.code.content).not.toMatch(/OMIT/);
          expect(page.code.content.endsWith('\n')).toBe(true);
        }
      }
    }

    expect(translationBlocks).toBe(339);
    expect(translationCharacters).toBe(35785);
  });

  it('writes the lesson index in the canonical order', () => {
    const index = readIndex();

    expect(index.source).toEqual({
      repository: 'golang/website',
      commit: 'd1edce5b8ec957935895f507f3253d6e02447a6c',
    });
    expect(index.lessons.map((lesson) => lesson.id)).toEqual([...LESSON_IDS]);

    for (const summary of index.lessons) {
      expect(isContentLessonId(summary.id)).toBe(true);
      if (!isContentLessonId(summary.id)) {
        throw new Error(`unknown lesson id: ${summary.id}`);
      }
      const lesson = readLesson(summary.id);
      expect(summary.title).toBe(lesson.title);
      expect(summary.description).toBe(lesson.description);
      expect(summary.pageCount).toBe(lesson.pages.length);
      expect(summary.pageTitles).toEqual(lesson.pages.map((page) => page.title));
    }
  });

  it('copies the tour image to public/', () => {
    const lesson = readLesson('concurrency');
    const image = lesson.pages[6].blocks.find((block) => block.kind === 'image');
    expect(image).toEqual({ id: 'concurrency/6/1', kind: 'image', src: '/tour/images/tree.png' });
    expect(fs.statSync(path.join(ROOT_DIR, 'public', 'tour', 'images', 'tree.png')).size).toBe(
      14473,
    );
  });
});
