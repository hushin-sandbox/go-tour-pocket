import type { LessonCatalog } from './catalog';
import { adjacentPages, flattenCatalog, primaryText } from './catalog';

const catalog: LessonCatalog = [
  {
    id: 'welcome',
    title: { en: 'Welcome!', ja: 'ようこそ！' },
    description: { en: 'Welcome', ja: 'ようこそ' },
    pageTitles: [
      { en: 'Hello', ja: 'こんにちは' },
      { en: 'Go local', ja: 'ローカルで Go' },
    ],
  },
  {
    id: 'basics',
    title: { en: 'Basics', ja: '基本' },
    description: { en: 'Basics', ja: '基本' },
    pageTitles: [{ en: 'Packages', ja: 'パッケージ' }],
  },
];

describe('lesson catalog', () => {
  it('flattens pages across lessons in catalog order', () => {
    expect(flattenCatalog(catalog).map((page) => `${page.lessonId}/${page.pageIndex}`)).toEqual([
      'welcome/0',
      'welcome/1',
      'basics/0',
    ]);
  });

  it('returns the previous and next page, crossing lesson boundaries', () => {
    expect(adjacentPages(catalog, 'welcome', 1)).toMatchObject({
      prev: { lessonId: 'welcome', pageIndex: 0 },
      next: { lessonId: 'basics', pageIndex: 0 },
    });
    expect(adjacentPages(catalog, 'welcome', 0).prev).toBeUndefined();
    expect(adjacentPages(catalog, 'basics', 0).next).toBeUndefined();
  });

  it('returns no neighbours for an unknown page', () => {
    expect(adjacentPages(catalog, 'basics', 99)).toEqual({});
  });

  it('prefers Japanese titles and falls back to English', () => {
    expect(primaryText({ en: 'Basics', ja: '基本' })).toBe('基本');
    expect(primaryText({ en: 'Basics' })).toBe('Basics');
  });
});
