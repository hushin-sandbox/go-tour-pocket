import { describe, expect, it } from 'vitest';
import { buildLicensesData } from './licenses';

const MAIN = {
  sections: [
    {
      id: 'content',
      title: 'コンテンツ',
      description: '説明',
      entries: [
        {
          id: 'content:tour-en',
          name: 'A Tour of Go の本文（英語原文）',
          version: null,
          license: 'CC BY 4.0',
          author: 'The Go Authors',
          url: 'https://go.dev/tour/',
          text: '要旨',
          note: null,
          extras: [],
        },
      ],
    },
  ],
};

const WORKBOX = [
  {
    id: 'service-worker:workbox-core',
    name: 'workbox-core',
    version: '7.4.1',
    license: 'MIT',
    author: 'Google LLC',
    url: 'https://github.com/GoogleChrome/workbox',
    text: 'MIT License',
    note: null,
    extras: [],
  },
];

describe('buildLicensesData', () => {
  it('Service Worker のエントリを最後のセクションに足す', () => {
    const data = buildLicensesData(MAIN, WORKBOX);
    expect(data.sections.map((section) => section.id)).toEqual(['content', 'service-worker']);
    expect(data.sections[1]?.title).toBe('Service Worker（Workbox）');
    expect(data.sections[1]?.entries[0]?.name).toBe('workbox-core');
  });

  it('Service Worker のエントリが無ければセクションを足さない', () => {
    expect(buildLicensesData(MAIN, []).sections.map((section) => section.id)).toEqual(['content']);
  });

  it('壊れたデータを拒否する', () => {
    expect(() => buildLicensesData({ sections: [{ id: 'unknown' }] }, [])).toThrow();
    expect(() => buildLicensesData(MAIN, [{ name: 'no id' }])).toThrow();
  });
});
