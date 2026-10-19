/**
 * `content/en` と `content/ja` の DTO。
 *
 * worker と react-app の両方から読まれるので、ここには型と定数だけを置く。
 * 生成ロジックは `scripts/content` にある。
 */

/** レッスンの並び順。コンテンツの取得元（golang/website）の並びに合わせる。 */
export const LESSON_IDS = [
  'welcome',
  'basics',
  'flowcontrol',
  'moretypes',
  'methods',
  'generics',
  'concurrency',
] as const;

export type ContentLessonId = (typeof LESSON_IDS)[number];

export type ParagraphBlock = {
  id: string;
  hash: string;
  kind: 'p';
  text: string;
};

export type ListBlock = {
  id: string;
  hash: string;
  kind: 'list';
  items: string[];
};

/** タブ字下げのコードブロック。訳さない。 */
export type PreBlock = {
  id: string;
  kind: 'pre';
  text: string;
};

/** `.image`。src はアプリ内のパス（例: `/tour/images/tree.png`）。訳さない。 */
export type ImageBlock = {
  id: string;
  kind: 'image';
  src: string;
};

export type Block = ParagraphBlock | ListBlock | PreBlock | ImageBlock;

/** 訳す対象のブロック。 */
export type TranslatableBlock = ParagraphBlock | ListBlock;

export type Page = {
  title: string;
  blocks: Block[];
  /** `.play` のファイル。OMIT 行を除去済み。 */
  code?: {
    name: string;
    content: string;
  };
};

export type Lesson = {
  id: string;
  title: string;
  description: string;
  /** 0 始まり。URL は 1 始まり。 */
  pages: Page[];
};

/** `content/en/index.json` の 1 レッスン分。 */
export type LessonSummary = {
  id: string;
  title: string;
  description: string;
  pageCount: number;
  pageTitles: string[];
};

export type ContentSource = {
  repository: string;
  commit: string;
};

export type LessonIndex = {
  source: ContentSource;
  lessons: LessonSummary[];
};

/** `content/ja` の 1 ブロック分。key は英語側の block id。 */
export type LessonJaBlock = {
  /** 訳したときの英語原文の hash。 */
  hash: string;
  text?: string;
  items?: string[];
};

export type LessonJaPage = {
  title: string;
  blocks: Record<string, LessonJaBlock>;
};

export type LessonJa = {
  id: string;
  title: string;
  description: string;
  pages: LessonJaPage[];
};
