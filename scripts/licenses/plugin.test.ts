import { describe, expect, it } from 'vitest';
import { assembleLicensesData, serializeLicensesData, validateLicensesData } from './collect.ts';
import {
  contentHash,
  isServiceWorkerFile,
  patchPrecacheRevision,
  replaceMarker,
} from './plugin.ts';

const ENTRY = {
  id: 'content:tour-en',
  name: 'A Tour of Go の本文（英語原文）',
  version: null,
  license: 'CC BY 4.0',
  author: 'The Go Authors',
  url: 'https://go.dev/tour/',
  text: '要旨',
  note: null,
  extras: [],
};

describe('assembleLicensesData', () => {
  it('section の並びと見出しを固定する', () => {
    const data = assembleLicensesData({ content: [ENTRY], go: [], npm: [] });
    expect(data.sections.map((section) => section.id)).toEqual(['content', 'go', 'npm']);
    expect(data.sections[0]?.title).toBe('コンテンツ');
    expect(serializeLicensesData(data)).toContain('"id": "content:tour-en"');
  });

  it('id の重複を検出する', () => {
    expect(() =>
      validateLicensesData({
        sections: [{ id: 'content', title: 't', description: 'd', entries: [ENTRY, ENTRY] }],
      }),
    ).toThrow('id が重複しています');
  });

  it('スキーマに合わないデータを拒否する', () => {
    expect(() => validateLicensesData({ sections: [{ id: 'unknown' }] })).toThrow();
  });
});

describe('replaceMarker', () => {
  it('マーカーを JSON 文字列として埋め込み、JSON.parse できるようにする', () => {
    const value = { name: 'react "quoted"', lines: ['a', 'b'] };
    const code = replaceMarker(
      'export const data = JSON.parse("__MARKER__");',
      '__MARKER__',
      value,
    );
    expect(code).not.toContain('__MARKER__');
    const literal = /JSON\.parse\((".*")\);/.exec(code)?.[1];
    expect(literal).toBeDefined();
    expect(JSON.parse(JSON.parse(literal ?? 'null'))).toEqual(value);
  });
});

describe('patchPrecacheRevision', () => {
  it('revision:null を内容のハッシュに置き換える', () => {
    const sw = '{url:"assets/licenses-abc.js",revision:null},{url:"index.html",revision:"1234"}';
    expect(patchPrecacheRevision(sw, 'assets/licenses-abc.js', 'deadbeef')).toBe(
      '{url:"assets/licenses-abc.js",revision:"deadbeef"},{url:"index.html",revision:"1234"}',
    );
  });

  it('既存の revision も置き換える', () => {
    const sw = '{url:"licenses-data.js",revision:"old"}';
    expect(patchPrecacheRevision(sw, 'licenses-data.js', 'new')).toBe(
      '{url:"licenses-data.js",revision:"new"}',
    );
  });

  it('対象が無ければ何もしない', () => {
    const sw = '{url:"index.html",revision:"1234"}';
    expect(patchPrecacheRevision(sw, 'assets/licenses-abc.js', 'deadbeef')).toBe(sw);
  });
});

describe('isServiceWorkerFile', () => {
  it('sw.js と workbox-*.js だけを対象にする', () => {
    expect(isServiceWorkerFile('sw.js')).toBe(true);
    expect(isServiceWorkerFile('workbox-9c191d2f.js')).toBe(true);
    expect(isServiceWorkerFile('registerSW.js')).toBe(false);
    expect(isServiceWorkerFile('sw.js.map')).toBe(false);
  });
});

describe('contentHash', () => {
  it('md5 の 16 進数を返す', () => {
    expect(contentHash('abc')).toMatch(/^[0-9a-f]{32}$/);
  });
});
