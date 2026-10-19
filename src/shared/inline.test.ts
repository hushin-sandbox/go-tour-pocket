/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { LESSON_IDS } from './content.ts';
import type { ContentLessonId, Lesson } from './content.ts';
import { inlineCodeValues, inlineText, inlineUrlValues, parseInline } from './inline.ts';
import type { InlineToken } from './inline.ts';
import basicsRaw from '../../content/en/basics.json?raw';
import concurrencyRaw from '../../content/en/concurrency.json?raw';
import flowcontrolRaw from '../../content/en/flowcontrol.json?raw';
import genericsRaw from '../../content/en/generics.json?raw';
import methodsRaw from '../../content/en/methods.json?raw';
import moretypesRaw from '../../content/en/moretypes.json?raw';
import welcomeRaw from '../../content/en/welcome.json?raw';
import fixtureRaw from './inline.present-fixture.json?raw';

/**
 * `golang.org/x/tools/present` v0.52.0 の `present.Style` で content/en の
 * 全 p/list を HTML 化した結果のうち、単純な HTML エスケープと異なるもの。
 * 単純な部分はテスト側でエスケープして比較する。
 *
 * 期待値の生成には Go の小さなツールを使った（リポジトリには置かない）。
 * コンテンツを更新したら、同じバージョンの present で再生成すること。
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Go の present で生成した固定のテストデータ
const PRESENT_HTML: Record<string, string> = JSON.parse(fixtureRaw) as Record<string, string>;

const LESSON_SOURCES: Record<ContentLessonId, string> = {
  welcome: welcomeRaw,
  basics: basicsRaw,
  flowcontrol: flowcontrolRaw,
  moretypes: moretypesRaw,
  methods: methodsRaw,
  generics: genericsRaw,
  concurrency: concurrencyRaw,
};

const text = (value: string): InlineToken => ({ type: 'text', value });
const code = (value: string): InlineToken => ({ type: 'code', value });
const em = (value: string): InlineToken => ({ type: 'em', value });
const strong = (value: string): InlineToken => ({ type: 'strong', value });
const link = (url: string, label: InlineToken[]): InlineToken => ({ type: 'link', url, label });

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&#34;',
  "'": '&#39;',
};

/** Go の html.EscapeString と同じ。 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (char) => HTML_ESCAPES[char]);
}

const SCHEME = /^([A-Za-z][A-Za-z0-9+.-]*):/u;

/** テスト用に present.Style と同じ HTML を組み立てる。 */
function renderHtml(tokens: InlineToken[]): string {
  let html = '';
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        html += escapeHtml(token.value);
        break;
      case 'code':
        html += `<code>${escapeHtml(token.value)}</code>`;
        break;
      case 'em':
        html += `<i>${escapeHtml(token.value)}</i>`;
        break;
      case 'strong':
        html += `<b>${escapeHtml(token.value)}</b>`;
        break;
      case 'link': {
        const href = escapeHtml(token.url);
        const scheme = SCHEME.exec(token.url)?.[1];
        // present は絶対 URL を _blank、相対 URL と javascript: を _self にする。
        const target = scheme === undefined || scheme === 'javascript' ? '_self' : '_blank';
        const label = renderHtml(token.label);
        html += `<a href="${href}" target="${target}">${label === '' ? href : label}</a>`;
        break;
      }
    }
  }
  return html;
}

function readLesson(raw: string): Lesson {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- content/en は生成物
  return JSON.parse(raw) as Lesson;
}

describe('parseInline', () => {
  it('returns text tokens when there is no markup', () => {
    expect(parseInline('')).toEqual([]);
    expect(parseInline('hello world')).toEqual([text('hello world')]);
    expect(parseInline('a_variable_name')).toEqual([text('a_variable_name')]);
    expect(parseInline('foo*bar*baz')).toEqual([text('foo*bar*baz')]);
    expect(parseInline('(_a)')).toEqual([text('(_a)')]);
  });

  const styleCases: [string, InlineToken[]][] = [
    [' ', [text(' ')]],
    ['_a_', [em('a')]],
    ['*a*', [strong('a')]],
    ['`a`', [code('a')]],
    ['_a_b_', [em('a b')]],
    ['_a__b_', [em('a_b')]],
    ['_a___b_', [em('a_ b')]],
    ['*a**b*?', [strong('a*b'), text('?')]],
    ['_a_<>_b_.', [em('a <> b'), text('.')]],
    ['(_a_)', [text('('), em('a'), text(')')]],
    [
      '((_a_), _b_, _c_).',
      [text('(('), em('a'), text('), '), em('b'), text(', '), em('c'), text(').')],
    ],
    [
      '_Why_use_scoped__ptr_? Use plain ***ptr* instead.',
      [em('Why use scoped_ptr'), text('? Use plain '), strong('*ptr'), text(' instead.')],
    ],
    ["`go`get`'s codebase", [code('go get'), text("'s codebase")]],
    ['`go`get`’s codebase', [code('go get'), text('’s codebase')]],
    [
      'Markup—_especially_italic_text_—can easily be overused.',
      [text('Markup—'), em('especially italic text'), text('—can easily be overused.')],
    ],
    // 閉じマーカーの直前にある同じマーカーは、閉じマーカーごと 2 文字で本物の文字になる。
    ['_a__', [em('a_')]],
    ['**', [strong('')]],
  ];

  it.each(styleCases)('parses %j like present', (input, expected) => {
    expect(parseInline(input)).toEqual(expected);
  });

  it('expands inner markers of a code span to spaces', () => {
    expect(parseInline('`package`rand`')).toEqual([code('package rand')]);
    expect(parseInline('`IPAddr{1,`2,`3,`4}`')).toEqual([code('IPAddr{1, 2, 3, 4}')]);
  });

  it('handles bold and italic words containing inner markers', () => {
    expect(parseInline('*Another*note:*')).toEqual([strong('Another note:')]);
    expect(parseInline('_mutual_exclusion_')).toEqual([em('mutual exclusion')]);
    expect(parseInline('*Note:*')).toEqual([strong('Note:')]);
  });

  it('accepts Japanese text around markers', () => {
    expect(parseInline('Goの`fmt`パッケージ')).toEqual([
      text('Goの'),
      code('fmt'),
      text('パッケージ'),
    ]);
    expect(parseInline('これは_強調_の文です。')).toEqual([
      text('これは'),
      em('強調'),
      text('の文です。'),
    ]);
    expect(parseInline('*重要*な話')).toEqual([strong('重要'), text('な話')]);
    expect(parseInline('_人々_の生活')).toEqual([em('人々'), text('の生活')]);
    expect(parseInline('「*強調*」')).toEqual([text('「'), strong('強調'), text('」')]);
    expect(parseInline('*強調*、続く')).toEqual([strong('強調'), text('、続く')]);
  });

  it('splits Japanese punctuation between inline spans', () => {
    expect(parseInline('`int`、`uint`、`uintptr` 型')).toEqual([
      code('int'),
      text('、'),
      code('uint'),
      text('、'),
      code('uintptr'),
      text(' 型'),
    ]);
  });

  it('parses a code span after a link in Japanese text', () => {
    expect(parseInline('[[/pkg][doc]]では、`append` が')).toEqual([
      link('/pkg', [text('doc')]),
      text('では、'),
      code('append'),
      text(' が'),
    ]);
  });

  it('parses inline links', () => {
    expect(parseInline('[[http://golang.org]]')).toEqual([
      link('http://golang.org', [text('golang.org')]),
    ]);
    expect(parseInline('[[/doc/]]')).toEqual([link('/doc/', [text('/doc/')])]);
    expect(parseInline('[[mailto:gopher@golang.org]]')).toEqual([
      link('mailto:gopher@golang.org', [text('gopher@golang.org')]),
    ]);
    expect(parseInline('[[http://golang.org][*link*]]')).toEqual([
      link('http://golang.org', [strong('link')]),
    ]);
    expect(parseInline('[[http://golang.org][so _many_ *Gophers*]]')).toEqual([
      link('http://golang.org', [text('so '), em('many'), text(' '), strong('Gophers')]),
    ]);
    expect(parseInline('my talk ([[http://talks.golang.org/][slides here]])')).toEqual([
      text('my talk ('),
      link('http://talks.golang.org/', [text('slides here')]),
      text(')'),
    ]);
    // 空のラベルは URL をそのまま表示する。
    expect(parseInline('[[http://golang.org][]]')).toEqual([
      link('http://golang.org', [text('http://golang.org')]),
    ]);
  });

  it('accepts quotes in URLs because present parses HTML-escaped text', () => {
    expect(parseInline('[[javascript:highlight(".logo")][A Tour of Go]]')).toEqual([
      link('javascript:highlight(".logo")', [text('A Tour of Go')]),
    ]);
  });

  it('leaves invalid links as text', () => {
    expect(parseInline('[[http://bad[url]]')).toEqual([text('[[http://bad[url]]')]);
    expect(parseInline('[[http://bad`char.com]]')).toEqual([text('[[http://bad`char.com]]')]);
    expect(inlineUrlValues('[[http:// *spaces* .com]]')).toEqual([]);
  });
});

describe('inline helpers', () => {
  it('returns the visible text of tokens', () => {
    expect(inlineText(parseInline('_a_b_ *c* `d` [[/x][e]]'))).toBe('a b c d e');
  });

  it('collects code values including link labels', () => {
    expect(inlineCodeValues('Use `fmt` and [[/pkg/sync/][`sync`]].')).toEqual(['fmt', 'sync']);
    expect(inlineCodeValues('`a` and `a`')).toEqual(['a', 'a']);
  });

  it('collects link URLs', () => {
    expect(inlineUrlValues('[[/a][A]] and [[https://x][X]]')).toEqual(['/a', 'https://x']);
    expect(inlineUrlValues('[[bad url][X]] and [[/ok][Y]]')).toEqual(['/ok']);
    // present はリンクを font より先に切り出すので、` で囲んでもリンクとして扱う。
    expect(inlineUrlValues('`[[/link-in-code][x]]`')).toEqual(['/link-in-code']);
  });
});

describe('present compatibility', () => {
  it('matches golang.org/x/tools/present for every English block', () => {
    const unusedFixtureKeys = new Set(Object.keys(PRESENT_HTML));
    let parts = 0;

    const check = (key: string, source: string): void => {
      const expected = PRESENT_HTML[key] ?? escapeHtml(source);
      expect(renderHtml(parseInline(source)), key).toBe(expected);
      unusedFixtureKeys.delete(key);
    };

    for (const lessonId of LESSON_IDS) {
      const lesson = readLesson(LESSON_SOURCES[lessonId]);
      expect(lesson.id).toBe(lessonId);
      for (const page of lesson.pages) {
        for (const block of page.blocks) {
          if (block.kind === 'p') {
            parts++;
            check(block.id, block.text);
          } else if (block.kind === 'list') {
            for (const [index, item] of block.items.entries()) {
              parts++;
              check(`${block.id}#${index}`, item);
            }
          }
        }
      }
    }

    expect(parts).toBe(356);
    expect([...unusedFixtureKeys]).toEqual([]);
  });
});
