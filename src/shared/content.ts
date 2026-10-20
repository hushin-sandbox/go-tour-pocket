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

/** エディタのチップで切り替える、あらかじめ用意したコードのパターン。 */
export type CodeVariant = {
  id: string;
  /** チップに出す短い名前（16 文字以内を目安）。 */
  label: string;
  /** 選択中にチップの下へ出す 1 文の説明。 */
  note?: string;
  code: string;
};

/** `content/variants/<lesson>.json` の 1 ページ分。key は 0 始まりのページ index。 */
export type PageCodeVariants = {
  /** パターンを書いたときの原文コードの hash。原文が変わったら検出する。 */
  hash: string;
  /** 原文のコードを実行すると何が起きるかの 1 文。 */
  originalNote?: string;
  variants: CodeVariant[];
};

export type LessonVariants = {
  id: string;
  pages: Record<string, PageCodeVariants>;
};

/** レッスンを読んだあとの理解確認問題。 */
export type QuizQuestion = {
  /** レッスン内で一意な kebab-case。 */
  id: string;
  /** 根拠になる Tour のページ。0 始まり（block id や content/variants のキーと同じ数え方）。 */
  pageIndex: number;
  /** 問題文。`` ` `` で囲んだ部分がコード（空白可。present 記法ではない。src/shared/quiz-text.ts）。 */
  prompt: string;
  /** 問題に添える Go コード。末尾は改行で終える。無ければ省略。 */
  code?: string;
  /** 選択肢。3〜4 個。`` ` `` で囲んだ部分がコード（空白可。強調・リンクなし）。 */
  choices: string[];
  /** 正解の choices の index（0 始まり）。 */
  answer: number;
  /** 正誤どちらでも回答後に出す解説。1〜3 文。`` ` `` で囲んだ部分がコード（空白可。強調・リンクなし）。 */
  explanation: string;
};

/** `content/quiz/<lesson>.json`。問題のあるレッスンだけファイルがある。 */
export type LessonQuiz = {
  /** ファイル名と一致するレッスン id。 */
  id: string;
  questions: QuizQuestion[];
};
