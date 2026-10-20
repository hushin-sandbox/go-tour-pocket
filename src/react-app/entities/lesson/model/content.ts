import { z } from 'zod';
import {
  LESSON_IDS,
  type ContentLessonId,
  type Lesson,
  type LessonIndex,
  type LessonJa,
  type LessonVariants,
} from '@/shared/content';
import { joinLesson, type JoinedLesson } from './join';

const paragraphBlockSchema = z.object({
  id: z.string(),
  hash: z.string(),
  kind: z.literal('p'),
  text: z.string(),
});

const listBlockSchema = z.object({
  id: z.string(),
  hash: z.string(),
  kind: z.literal('list'),
  items: z.array(z.string()),
});

const preBlockSchema = z.object({
  id: z.string(),
  kind: z.literal('pre'),
  text: z.string(),
});

const imageBlockSchema = z.object({
  id: z.string(),
  kind: z.literal('image'),
  src: z.string(),
});

const blockSchema = z.discriminatedUnion('kind', [
  paragraphBlockSchema,
  listBlockSchema,
  preBlockSchema,
  imageBlockSchema,
]);

const pageSchema = z.object({
  title: z.string(),
  blocks: z.array(blockSchema),
  code: z.object({ name: z.string(), content: z.string() }).optional(),
});

const lessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  pages: z.array(pageSchema),
});

const lessonIndexSchema = z.object({
  source: z.object({ repository: z.string(), commit: z.string() }),
  lessons: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      pageCount: z.number().int().nonnegative(),
      pageTitles: z.array(z.string()),
    }),
  ),
});

const lessonJaBlockSchema = z.object({
  hash: z.string(),
  text: z.string().optional(),
  items: z.array(z.string()).optional(),
});

const lessonJaSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  pages: z.array(
    z.object({
      title: z.string(),
      blocks: z.record(z.string(), lessonJaBlockSchema),
    }),
  ),
});

const codeVariantSchema = z.object({
  id: z.string(),
  label: z.string(),
  note: z.string().optional(),
  code: z.string(),
});

const pageCodeVariantsSchema = z.object({
  hash: z.string(),
  originalNote: z.string().optional(),
  variants: z.array(codeVariantSchema),
});

const lessonVariantsSchema = z.object({
  id: z.string(),
  pages: z.record(z.string(), pageCodeVariantsSchema),
});

/**
 * レッスン JSON は `?raw` で読んでから zod で検証する。
 * `?raw` にしているのは (1) tsconfig に resolveJsonModule を足さずに済む、
 * (2) 生成物が壊れていたら画面ではなくテスト/実行時に気づける、の 2 点のため。
 */
type RawJsonModule = { default: string };

const enLessonLoaders: Record<ContentLessonId, () => Promise<RawJsonModule>> = {
  welcome: () => import('../../../../../content/en/welcome.json?raw'),
  basics: () => import('../../../../../content/en/basics.json?raw'),
  flowcontrol: () => import('../../../../../content/en/flowcontrol.json?raw'),
  moretypes: () => import('../../../../../content/en/moretypes.json?raw'),
  methods: () => import('../../../../../content/en/methods.json?raw'),
  generics: () => import('../../../../../content/en/generics.json?raw'),
  concurrency: () => import('../../../../../content/en/concurrency.json?raw'),
};

const jaLessonLoaders: Record<ContentLessonId, () => Promise<RawJsonModule>> = {
  welcome: () => import('../../../../../content/ja/welcome.json?raw'),
  basics: () => import('../../../../../content/ja/basics.json?raw'),
  flowcontrol: () => import('../../../../../content/ja/flowcontrol.json?raw'),
  moretypes: () => import('../../../../../content/ja/moretypes.json?raw'),
  methods: () => import('../../../../../content/ja/methods.json?raw'),
  generics: () => import('../../../../../content/ja/generics.json?raw'),
  concurrency: () => import('../../../../../content/ja/concurrency.json?raw'),
};

/**
 * コードパターンはパターンのあるレッスンにしかファイルが無い（ディレクトリ自体が
 * 無いこともある）。存在しないレッスンを自然に扱うため、静的な import ではなく
 * glob で集め、ファイル名からレッスン id を引く。
 */
const variantModules = import.meta.glob<string>('../../../../../content/variants/*.json', {
  query: '?raw',
  import: 'default',
});

const variantLoaders = new Map<string, () => Promise<string>>();
for (const [modulePath, loader] of Object.entries(variantModules)) {
  const fileName = modulePath.slice(modulePath.lastIndexOf('/') + 1);
  variantLoaders.set(fileName.replace(/\.json$/, ''), loader);
}

async function loadJsonText(loader: () => Promise<RawJsonModule>): Promise<unknown> {
  const module = await loader();
  return JSON.parse(module.default);
}

export function isContentLessonId(value: string): value is ContentLessonId {
  return LESSON_IDS.some((lessonId) => lessonId === value);
}

/** `content/en/index.json`。一覧画面と目次のレッスン並びに使う。 */
export async function loadLessonIndex(): Promise<LessonIndex> {
  return lessonIndexSchema.parse(
    await loadJsonText(() => import('../../../../../content/en/index.json?raw')),
  );
}

export async function loadLesson(id: ContentLessonId): Promise<Lesson> {
  return lessonSchema.parse(await loadJsonText(enLessonLoaders[id]));
}

export async function loadLessonJa(id: ContentLessonId): Promise<LessonJa> {
  return lessonJaSchema.parse(await loadJsonText(jaLessonLoaders[id]));
}

/** パターンの無いレッスンは undefined。JSON が壊れている場合は reject する。 */
export async function loadLessonVariants(id: ContentLessonId): Promise<LessonVariants | undefined> {
  const loader = variantLoaders.get(id);
  if (loader === undefined) return undefined;
  const raw: unknown = JSON.parse(await loader());
  return lessonVariantsSchema.parse(raw);
}

export type LessonContent = {
  en: Lesson;
  ja?: LessonJa;
  variants?: LessonVariants;
};

/** 読み込み済みレッスン。route の lesson id が検証済みなので id を絞り込む。 */
export type LoadedLesson = Omit<JoinedLesson, 'id'> & { id: ContentLessonId };

/**
 * レッスン 1 つ分の英語・日本語・コードパターンを読み込む。ja と patterns が壊れて
 * いても英語だけで表示できるよう、失敗は握りつぶして undefined にする
 * （英語は必ず読めなければならない）。
 */
export async function loadLessonContent(id: ContentLessonId): Promise<LessonContent> {
  const [en, ja, variants] = await Promise.all([
    loadLesson(id),
    loadLessonJa(id).catch(() => undefined),
    loadLessonVariants(id).catch(() => undefined),
  ]);
  return { en, ja, variants };
}

export async function loadJoinedLesson(id: ContentLessonId): Promise<LoadedLesson> {
  const { en, ja, variants } = await loadLessonContent(id);
  return { ...joinLesson(en, ja, variants), id };
}
