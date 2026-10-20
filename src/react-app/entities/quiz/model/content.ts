import { z } from 'zod';
import type { ContentLessonId, LessonQuiz } from '@/shared/content';

const quizQuestionSchema = z
  .object({
    id: z.string(),
    pageIndex: z.number().int().nonnegative(),
    prompt: z.string(),
    code: z.string().optional(),
    choices: z.array(z.string()),
    answer: z.number().int().nonnegative(),
    explanation: z.string(),
  })
  .refine((question) => question.answer < question.choices.length, {
    message: 'answer is out of range',
    path: ['answer'],
  });

const lessonQuizSchema = z.object({
  id: z.string(),
  questions: z.array(quizQuestionSchema),
});

/**
 * 確認問題は問題のあるレッスンにしかファイルが無い（ディレクトリ自体が無いこともある）。
 * コードパターン（`entities/lesson/model/content.ts`）と同じく、存在しないレッスンを
 * 自然に扱うため glob で集め、ファイル名からレッスン id を引く。
 */
type RawJsonLoader = () => Promise<string>;

const quizModules = import.meta.glob<string>('../../../../../content/quiz/*.json', {
  query: '?raw',
  import: 'default',
});

const quizLoaders = new Map<string, RawJsonLoader>();
for (const [modulePath, loader] of Object.entries(quizModules)) {
  const fileName = modulePath.slice(modulePath.lastIndexOf('/') + 1);
  quizLoaders.set(fileName.replace(/\.json$/, ''), loader);
}

/** そのレッスンに確認問題があるか。ファイルの有無だけで同期的に分かる。 */
export function hasLessonQuiz(id: ContentLessonId): boolean {
  return quizLoaders.has(id);
}

/** 問題の無いレッスンは undefined。JSON が壊れている場合は reject する。 */
export async function loadLessonQuiz(id: ContentLessonId): Promise<LessonQuiz | undefined> {
  const loader = quizLoaders.get(id);
  if (loader === undefined) return undefined;
  const raw: unknown = JSON.parse(await loader());
  return lessonQuizSchema.parse(raw);
}
