import { LESSON_IDS } from '@/shared/content';
import { loadJoinedLesson, loadLessonIndex, loadLessonJa, loadLessonVariants } from './content';

describe('lesson content', () => {
  it('joins every page and block of every lesson', async () => {
    const index = await loadLessonIndex();

    expect(index.lessons.map((lesson) => lesson.id)).toEqual([...LESSON_IDS]);

    for (const lessonId of LESSON_IDS) {
      const joined = await loadJoinedLesson(lessonId);
      const summary = index.lessons.find((lesson) => lesson.id === lessonId);

      expect(summary).toBeDefined();
      expect(joined.pages).toHaveLength(summary?.pageCount ?? -1);
      expect(joined.title.ja).toBeTruthy();

      for (const [pageIndex, page] of joined.pages.entries()) {
        expect(page.title.ja).toBeTruthy();
        expect(page.title.en).toBe(summary?.pageTitles[pageIndex]);

        for (const block of page.blocks) {
          if (block.kind === 'p') {
            expect(block.en.length).toBeGreaterThan(0);
            expect(block.ja, `${block.id} の日本語訳がありません`).toBeTruthy();
          }
          if (block.kind === 'list') {
            expect(block.items.length).toBeGreaterThan(0);
            for (const item of block.items) {
              expect(item.en.length).toBeGreaterThan(0);
              expect(item.ja, `${block.id} の日本語訳がありません`).toBeTruthy();
            }
          }
        }
      }
    }
  });

  it('keeps Japanese page titles aligned with English pages', async () => {
    for (const lessonId of LESSON_IDS) {
      const ja = await loadLessonJa(lessonId);
      const joined = await loadJoinedLesson(lessonId);

      expect(ja.pages).toHaveLength(joined.pages.length);
      expect(ja.pages.map((page) => page.title)).toEqual(joined.pages.map((page) => page.title.ja));
    }
  });

  it('leaves code pages without patterns untouched', async () => {
    // generics にはパターンのファイルを置かない（content/variants の仕様）
    expect(await loadLessonVariants('generics')).toBeUndefined();

    const joined = await loadJoinedLesson('generics');
    for (const page of joined.pages) {
      if (page.code !== undefined) {
        expect(page.code.variants).toEqual([]);
        expect(page.code.originalNote).toBeUndefined();
      }
    }
  });

  it('joins the pattern file with the code of the matching page', async () => {
    for (const lessonId of LESSON_IDS) {
      const variants = await loadLessonVariants(lessonId);
      if (variants === undefined) continue;

      const joined = await loadJoinedLesson(lessonId);
      expect(variants.id).toBe(lessonId);

      for (const [pageIndex, pageVariants] of Object.entries(variants.pages)) {
        const page = joined.pages[Number(pageIndex)];
        expect(page, `${lessonId} page ${pageIndex} がありません`).toBeDefined();
        expect(page.code, `${lessonId} page ${pageIndex} に code がありません`).toBeDefined();
        expect(page.code?.variants).toEqual(pageVariants.variants);
        expect(page.code?.originalNote).toEqual(pageVariants.originalNote);
      }
    }
  });
});
