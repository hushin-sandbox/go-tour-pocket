import type { ContentLessonId, LessonSummary } from '@/shared/content';
import { isContentLessonId, loadLessonIndex, loadLessonJa } from './content';
import type { LocalizedText } from './join';

/** 一覧で使うレッスンのメタデータ。本文は含めない。 */
export type CatalogLesson = {
  id: ContentLessonId;
  title: LocalizedText;
  description: LocalizedText;
  /** 0 始まり。URL に載せるときは +1 する。 */
  pageTitles: LocalizedText[];
};

export type LessonCatalog = CatalogLesson[];

/**
 * 一覧のモジュール。design.md の「モジュールごとにレッスンとページを並べる」に対応する。
 */
export const LESSON_MODULES = [
  { id: 'welcome', title: 'はじめに', lessonIds: ['welcome'] },
  { id: 'basics', title: '基本', lessonIds: ['basics', 'flowcontrol', 'moretypes'] },
  { id: 'methods', title: 'メソッドとインターフェース', lessonIds: ['methods'] },
  { id: 'generics', title: 'ジェネリクス', lessonIds: ['generics'] },
  { id: 'concurrency', title: '並行性', lessonIds: ['concurrency'] },
] as const satisfies readonly {
  id: string;
  title: string;
  lessonIds: readonly ContentLessonId[];
}[];

export function primaryText(text: LocalizedText): string {
  return text.ja ?? text.en;
}

export function findCatalogLesson(
  catalog: LessonCatalog,
  lessonId: ContentLessonId,
): CatalogLesson | undefined {
  return catalog.find((lesson) => lesson.id === lessonId);
}

/**
 * 全レッスンのメタデータを読み込む。ホームと目次で共有する。
 * 本文のレッスン JSON は動的 import の別チャンクだが、一覧用途でタイトルは必要なので
 * ここでは ja の JSON も読む（合計でも数十 KB）。
 */
export async function loadLessonCatalog(): Promise<LessonCatalog> {
  const index = await loadLessonIndex();
  const entries: (CatalogLesson | undefined)[] = await Promise.all(
    index.lessons.map(async (summary) => {
      if (!isCatalogSummary(summary)) return undefined;
      const ja = await loadLessonJa(summary.id).catch(() => undefined);
      return {
        id: summary.id,
        title: { en: summary.title, ja: ja?.title },
        description: { en: summary.description, ja: ja?.description },
        pageTitles: summary.pageTitles.map((title, pageIndex) => ({
          en: title,
          ja: ja?.pages[pageIndex]?.title,
        })),
      } satisfies CatalogLesson;
    }),
  );
  return entries.filter((entry): entry is CatalogLesson => entry !== undefined);
}

type CatalogSummary = LessonSummary & { id: ContentLessonId };

/** index.json の id は string なので、コンテンツ側の lesson id に絞る。 */
function isCatalogSummary(summary: LessonSummary): summary is CatalogSummary {
  return isContentLessonId(summary.id);
}

export type PageRef = {
  lessonId: ContentLessonId;
  pageIndex: number;
  lessonTitle: LocalizedText;
  pageTitle: LocalizedText;
};

/** 全レッスンのページを 1 本に並べる。前へ/次へのレッスン跨ぎに使う。 */
export function flattenCatalog(catalog: LessonCatalog): PageRef[] {
  return catalog.flatMap((lesson) =>
    lesson.pageTitles.map((pageTitle, pageIndex) => ({
      lessonId: lesson.id,
      pageIndex,
      lessonTitle: lesson.title,
      pageTitle,
    })),
  );
}

export function adjacentPages(
  catalog: LessonCatalog,
  lessonId: ContentLessonId,
  pageIndex: number,
): { prev?: PageRef; next?: PageRef } {
  const pages = flattenCatalog(catalog);
  const current = pages.findIndex(
    (page) => page.lessonId === lessonId && page.pageIndex === pageIndex,
  );
  if (current === -1) return {};
  return {
    prev: current > 0 ? pages[current - 1] : undefined,
    next: current < pages.length - 1 ? pages[current + 1] : undefined,
  };
}
