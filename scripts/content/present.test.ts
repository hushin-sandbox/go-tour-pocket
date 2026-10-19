import { describe, expect, it } from 'vitest';
import { parseArticle } from './present.ts';

function article(...lines: string[]): string {
  return `${lines.join('\n')}\n`;
}

describe('parseArticle', () => {
  it('parses title, subtitle, authors and pages', () => {
    const doc = parseArticle(
      article(
        'Welcome!',
        'Learn the tour.',
        '',
        'The Go Authors',
        'https://golang.org',
        '',
        '* First page',
        '',
        'Hello.',
        '',
        '* Second page',
        '',
        'World.',
      ),
    );

    expect(doc.title).toBe('Welcome!');
    expect(doc.subtitle).toBe('Learn the tour.');
    expect(doc.authors).toEqual([['The Go Authors', 'https://golang.org']]);
    expect(doc.pages.map((page) => page.title)).toEqual(['First page', 'Second page']);
    expect(doc.pages[0].blocks).toEqual([{ kind: 'text', lines: ['Hello.'] }]);
  });

  it('joins paragraph lines with spaces and drops # comments', () => {
    const doc = parseArticle(
      article(
        'Title',
        'Subtitle',
        '',
        'Author',
        '',
        '* Page',
        '',
        'first line',
        '#appengine: a remote server.',
        'second line',
        'third line',
      ),
    );

    expect(doc.pages[0].blocks).toEqual([
      { kind: 'text', lines: ['first line', 'second line', 'third line'] },
    ]);
  });

  it('does not treat a commented-out heading as a section', () => {
    const doc = parseArticle(
      article(
        'Title',
        'Subtitle',
        '',
        'Author',
        '',
        '* Real page',
        '',
        'text',
        '#appengine: * Ignored page',
        'more text',
        '',
        '* Last page',
      ),
    );

    expect(doc.pages.map((page) => page.title)).toEqual(['Real page', 'Last page']);
    expect(doc.pages[0].blocks).toEqual([{ kind: 'text', lines: ['text', 'more text'] }]);
  });

  it('parses a bullet list and joins wrapped item lines', () => {
    const doc = parseArticle(
      article(
        'Title',
        'Subtitle',
        '',
        'Author',
        '',
        '* Page',
        '',
        '- first',
        '- second',
        '  continued here',
        '- third',
        '',
        'after',
      ),
    );

    expect(doc.pages[0].blocks).toEqual([
      { kind: 'list', items: ['first', 'second continued here', 'third'] },
      { kind: 'text', lines: ['after'] },
    ]);
  });

  it('keeps blank-separated bullet groups as separate lists', () => {
    const doc = parseArticle(
      article('Title', 'Subtitle', '', 'Author', '', '* Page', '', '- first', '', '- second'),
    );

    expect(doc.pages[0].blocks).toEqual([
      { kind: 'list', items: ['first'] },
      { kind: 'list', items: ['second'] },
    ]);
  });

  it('parses pre blocks with tabs and spaces', () => {
    const doc = parseArticle(
      article(
        'Title',
        'Subtitle',
        '',
        'Author',
        '',
        '* Page',
        '',
        '\tline 1',
        '\t\tline 2',
        '',
        '\tline 3',
        '',
        '  func Index[T comparable](s []T, x T) int',
        '',
        'after',
      ),
    );

    expect(doc.pages[0].blocks).toEqual([
      { kind: 'pre', text: 'line 1\n    line 2\n\nline 3' },
      { kind: 'pre', text: 'func Index[T comparable](s []T, x T) int' },
      { kind: 'text', lines: ['after'] },
    ]);
  });

  it('drops comment lines inside pre blocks like present does', () => {
    const doc = parseArticle(
      article(
        'Title',
        'Subtitle',
        '',
        'Author',
        '',
        '* Page',
        '',
        '\tbefore',
        '# comment',
        '\tafter',
      ),
    );

    expect(doc.pages[0].blocks).toEqual([{ kind: 'pre', text: 'before\nafter' }]);
  });

  it('parses .play options and address', () => {
    const doc = parseArticle(
      article(
        'Title',
        'Subtitle',
        '',
        'Author',
        '',
        '* Page',
        '',
        '.play -edit -numbers prog.go /START/,/END/',
      ),
    );

    expect(doc.pages[0].blocks).toEqual([
      {
        kind: 'play',
        file: 'prog.go',
        edit: true,
        numbers: true,
        address: '/START/,/END/',
      },
    ]);
  });

  it('strips a trailing HL marker from .play', () => {
    const doc = parseArticle(
      article('Title', 'Subtitle', '', 'Author', '', '* Page', '', '.play prog.go HLxxx'),
    );

    expect(doc.pages[0].blocks).toEqual([
      { kind: 'play', file: 'prog.go', edit: false, numbers: false, address: '' },
    ]);
  });

  it('parses .image', () => {
    const doc = parseArticle(
      article(
        'Title',
        'Subtitle',
        '',
        'Author',
        '',
        '* Page',
        '',
        '.image /tour/static/img/tree.png',
      ),
    );

    expect(doc.pages[0].blocks).toEqual([{ kind: 'image', src: '/tour/static/img/tree.png' }]);
  });

  it('unescapes a leading period in paragraphs', () => {
    const doc = parseArticle(
      article('Title', 'Subtitle', '', 'Author', '', '* Page', '', '\\.not a directive'),
    );

    expect(doc.pages[0].blocks).toEqual([{ kind: 'text', lines: ['.not a directive'] }]);
  });

  it('rejects unknown directives and nested sections', () => {
    const header = article('Title', 'Subtitle', '', 'Author', '', '* Page', '');
    expect(() => parseArticle(`${header}.background bg.png\n`)).toThrow(
      /unknown present directive/,
    );
    expect(() => parseArticle(`${header}** Nested\n`)).toThrow(/nested sections/);
  });
});
