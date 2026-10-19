import { describe, expect, it } from 'vitest';
import { SOURCE_COMMIT, SOURCE_REPOSITORY } from '../content/source.ts';
import {
  CC_BY_SUMMARY,
  CC_BY_URL,
  collectContentEntries,
  GO_TOUR_JP_URL,
} from './content-licenses.ts';

const INPUT = {
  websiteLicense:
    'Copyright 2009 The Go Authors.\n\nRedistribution and use in source and binary forms...',
  goLicense: 'Copyright 2009 The Go Authors.',
};

describe('collectContentEntries', () => {
  it('本文・日本語訳・コード例の 3 件を作る', () => {
    const entries = collectContentEntries(INPUT);
    expect(entries.map((entry) => entry.id)).toEqual([
      'content:tour-en',
      'content:tour-ja',
      'content:tour-examples',
    ]);
    expect(entries.map((entry) => entry.license)).toEqual([
      'CC BY 4.0',
      'CC BY 4.0',
      'BSD-3-Clause',
    ]);
  });

  it('本文の表記に著作者・原文 URL・固定コミット・改変内容が入る', () => {
    const [article] = collectContentEntries(INPUT);
    expect(article?.author).toBe('The Go Authors');
    expect(article?.url).toBe('https://go.dev/tour/');
    expect(article?.note).toContain(SOURCE_COMMIT);
    expect(article?.note).toContain(SOURCE_REPOSITORY);
    expect(article?.note).toContain('改変');
    expect(article?.text).toBe(CC_BY_SUMMARY);
    expect(article?.text).toContain(CC_BY_URL);
    expect(article?.extras).toEqual([
      { label: 'golang/website の LICENSE（BSD-3-Clause）', text: INPUT.websiteLicense },
    ]);
  });

  it('日本語訳に CC BY 4.0 と go-tour-jp へのクレジットが入る', () => {
    const [, translation] = collectContentEntries(INPUT);
    expect(translation?.license).toBe('CC BY 4.0');
    expect(translation?.note).toContain('新たに翻訳');
    expect(translation?.note).toContain(GO_TOUR_JP_URL);
    expect(translation?.note).toContain('BSD-3-Clause');
  });

  it('コード例は BSD-3-Clause の全文と Go 節への案内を持つ', () => {
    const [, , examples] = collectContentEntries(INPUT);
    expect(examples?.license).toBe('BSD-3-Clause');
    expect(examples?.text).toBe(INPUT.goLicense);
    expect(examples?.note).toContain('PATENTS');
  });
});
