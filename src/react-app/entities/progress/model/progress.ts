import { z } from 'zod';
import { LESSON_IDS, type ContentLessonId } from '@/shared/content';

export const PROGRESS_STORAGE_KEY = 'gotour:progress:v1';

export type ProgressStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type LastPage = {
  lessonId: ContentLessonId;
  /** 0 始まり。 */
  pageIndex: number;
};

export type Progress = {
  /** key は `${lessonId}/${pageIndex}`。値は既読の印として true だけを持つ。 */
  readPages: Record<string, true>;
  lastPage: LastPage | null;
};

const lastPageSchema = z.object({
  lessonId: z.enum(LESSON_IDS),
  pageIndex: z.number().int().nonnegative(),
});

const progressSchema = z.object({
  readPages: z.record(z.string(), z.literal(true)).default({}),
  lastPage: lastPageSchema.nullable().default(null),
});

export function emptyProgress(): Progress {
  return { readPages: {}, lastPage: null };
}

export function pageKey(lessonId: ContentLessonId, pageIndex: number): string {
  return `${lessonId}/${pageIndex}`;
}

export function isPageRead(
  progress: Progress,
  lessonId: ContentLessonId,
  pageIndex: number,
): boolean {
  return progress.readPages[pageKey(lessonId, pageIndex)] !== undefined;
}

export function countReadPages(
  progress: Progress,
  lessonId: ContentLessonId,
  pageCount: number,
): number {
  let count = 0;
  for (let index = 0; index < pageCount; index += 1) {
    if (isPageRead(progress, lessonId, index)) count += 1;
  }
  return count;
}

/** ページを開いたときの更新。既読を立て、最後に開いたページを差し替える。 */
export function markPageOpened(
  progress: Progress,
  lessonId: ContentLessonId,
  pageIndex: number,
): Progress {
  return {
    readPages: { ...progress.readPages, [pageKey(lessonId, pageIndex)]: true },
    lastPage: { lessonId, pageIndex },
  };
}

/** 壊れた JSON や古い形は空の進捗として扱う（localStorage は信用しない）。 */
export function parseProgress(raw: string | null): Progress {
  if (raw === null) return emptyProgress();
  try {
    const value: unknown = JSON.parse(raw);
    const parsed = progressSchema.safeParse(value);
    return parsed.success ? parsed.data : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

// Worker / テスト環境には localStorage が無い。DOM 型に依存せず、実行時に有無を見る。
declare const localStorage: ProgressStorage | undefined;

function defaultStorage(): ProgressStorage | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

export function readProgress(storage?: ProgressStorage): Progress {
  const target = storage ?? defaultStorage();
  if (target === undefined) return emptyProgress();
  try {
    return parseProgress(target.getItem(PROGRESS_STORAGE_KEY));
  } catch {
    return emptyProgress();
  }
}

export function writeProgress(progress: Progress, storage?: ProgressStorage): void {
  const target = storage ?? defaultStorage();
  if (target === undefined) return;
  try {
    target.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ストレージが使えない（プライベートモード等）ときは保存を諦める
  }
}
