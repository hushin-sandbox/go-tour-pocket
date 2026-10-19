import type { Lesson, LessonJa } from '@/shared/content';
import { joinLesson } from './join';

const en: Lesson = {
  id: 'basics',
  title: 'Basics',
  description: 'Description',
  pages: [
    {
      title: 'Packages',
      blocks: [
        {
          id: 'basics/0/0',
          hash: 'aaa',
          kind: 'p',
          text: 'Every Go program is made up of packages.',
        },
        {
          id: 'basics/0/1',
          hash: 'bbb',
          kind: 'p',
          text: 'Programs start running in package main.',
        },
        { id: 'basics/0/2', hash: 'ccc', kind: 'list', items: ['First', 'Second', 'Third'] },
        { id: 'basics/0/3', kind: 'pre', text: 'package main' },
        { id: 'basics/0/4', kind: 'image', src: '/tour/images/tree.png' },
      ],
      code: { name: 'main.go', content: 'package main\n' },
    },
  ],
};

const ja: LessonJa = {
  id: 'basics',
  title: '基本',
  description: '説明',
  pages: [
    {
      title: 'パッケージ',
      blocks: {
        'basics/0/0': { hash: 'aaa', text: 'Go のプログラムはパッケージで構成されます。' },
        // hash が古い訳は使わない
        'basics/0/1': { hash: 'old', text: '古い訳' },
        // 訳が欠けている項目は英語のまま
        'basics/0/2': { hash: 'ccc', items: ['1 番目'] },
      },
    },
  ],
};

describe('joinLesson', () => {
  it('joins paragraphs and list items by block id', () => {
    const joined = joinLesson(en, ja);
    const page = joined.pages[0];

    expect(joined.title).toEqual({ en: 'Basics', ja: '基本' });
    expect(page.title).toEqual({ en: 'Packages', ja: 'パッケージ' });
    expect(page.blocks.map((block) => block.id)).toEqual([
      'basics/0/0',
      'basics/0/1',
      'basics/0/2',
      'basics/0/3',
      'basics/0/4',
    ]);

    const [translated, stale, list, pre, image] = page.blocks;
    expect(translated).toMatchObject({
      kind: 'p',
      en: 'Every Go program is made up of packages.',
      ja: 'Go のプログラムはパッケージで構成されます。',
    });
    expect(stale).toMatchObject({
      kind: 'p',
      en: 'Programs start running in package main.',
      ja: undefined,
    });
    expect(list).toMatchObject({
      kind: 'list',
      items: [
        { en: 'First', ja: '1 番目' },
        { en: 'Second', ja: undefined },
        { en: 'Third', ja: undefined },
      ],
    });
    expect(pre).toEqual({ kind: 'pre', id: 'basics/0/3', text: 'package main' });
    expect(image).toEqual({ kind: 'image', id: 'basics/0/4', src: '/tour/images/tree.png' });
    expect(page.code).toEqual({ name: 'main.go', content: 'package main\n' });
  });

  it('falls back to English when the Japanese lesson is missing', () => {
    const joined = joinLesson(en);

    expect(joined.title).toEqual({ en: 'Basics', ja: undefined });
    expect(joined.description).toEqual({ en: 'Description', ja: undefined });
    expect(joined.pages[0].title).toEqual({ en: 'Packages', ja: undefined });
    expect(joined.pages[0].blocks[0]).toMatchObject({
      en: 'Every Go program is made up of packages.',
      ja: undefined,
    });
  });

  it('ignores Japanese pages that do not exist in English', () => {
    const joined = joinLesson(en, {
      ...ja,
      pages: [...ja.pages, { title: '余分', blocks: {} }],
    });

    expect(joined.pages).toHaveLength(1);
  });
});
