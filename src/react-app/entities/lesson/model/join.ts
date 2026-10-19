import type { Block, Lesson, LessonJa, ListBlock, ParagraphBlock } from '@/shared/content';

/** 英日を並べるための表示用テキスト。ja が無ければ英語だけになる。 */
export type LocalizedText = {
  en: string;
  ja?: string;
};

export type JoinedParagraphBlock = {
  kind: 'p';
  id: string;
  hash: string;
  en: string;
  ja?: string;
};

export type JoinedListItem = {
  en: string;
  ja?: string;
};

export type JoinedListBlock = {
  kind: 'list';
  id: string;
  hash: string;
  items: JoinedListItem[];
};

export type JoinedPreBlock = {
  kind: 'pre';
  id: string;
  text: string;
};

export type JoinedImageBlock = {
  kind: 'image';
  id: string;
  src: string;
};

export type JoinedBlock =
  | JoinedParagraphBlock
  | JoinedListBlock
  | JoinedPreBlock
  | JoinedImageBlock;

export type JoinedPage = {
  title: LocalizedText;
  blocks: JoinedBlock[];
  code?: {
    name: string;
    content: string;
  };
};

export type JoinedLesson = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  pages: JoinedPage[];
};

/**
 * 英語の block と日本語訳を block id で結合する。
 *
 * - ja のページは英語と同じ index で対応させる（content 側の仕様）
 * - ja が欠けている block / 項目は英語だけのままにする
 * - hash が一致しない訳は原文が変わった古い訳なので使わない（英語だけ表示する）
 */
export function joinLesson(en: Lesson, ja?: LessonJa): JoinedLesson {
  return {
    id: en.id,
    title: { en: en.title, ja: localizedValue(ja?.title) },
    description: { en: en.description, ja: localizedValue(ja?.description) },
    pages: en.pages.map((page, pageIndex) => {
      const jaPage = ja?.pages[pageIndex];
      return {
        title: { en: page.title, ja: localizedValue(jaPage?.title) },
        blocks: page.blocks.map((block) => joinBlock(block, jaPage?.blocks[block.id])),
        code: page.code,
      };
    }),
  };
}

function joinBlock(
  block: Block,
  ja: { hash: string; text?: string; items?: string[] } | undefined,
): JoinedBlock {
  if (block.kind === 'pre' || block.kind === 'image') {
    return block;
  }
  const translation = ja?.hash === block.hash ? ja : undefined;
  if (block.kind === 'p') {
    return joinParagraph(block, translation?.text);
  }
  return joinList(block, translation?.items);
}

function joinParagraph(block: ParagraphBlock, ja: string | undefined): JoinedParagraphBlock {
  return {
    kind: 'p',
    id: block.id,
    hash: block.hash,
    en: block.text,
    ja: localizedValue(ja),
  };
}

function joinList(block: ListBlock, jaItems: string[] | undefined): JoinedListBlock {
  return {
    kind: 'list',
    id: block.id,
    hash: block.hash,
    items: block.items.map((item, index) => ({
      en: item,
      ja: localizedValue(jaItems?.[index]),
    })),
  };
}

function localizedValue(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}
