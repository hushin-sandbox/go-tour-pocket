import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildLesson } from './build-content.ts';
import { contentHash, listHash } from './hash.ts';

const tempDirs: string[] = [];

function makeDirs(): { tourDir: string; publicDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-tour-content-'));
  tempDirs.push(root);
  const tourDir = path.join(root, 'tour');
  const publicDir = path.join(root, 'public');
  fs.mkdirSync(path.join(tourDir, 'static', 'img'), { recursive: true });
  fs.mkdirSync(publicDir, { recursive: true });
  return { tourDir, publicDir };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const ARTICLE = [
  'Fixture lesson',
  'A description.',
  '',
  'The Go Authors',
  '',
  '* First page',
  '',
  'Paragraph',
  'with two lines.',
  '',
  '- item one',
  '- item two',
  '',
  '\tcode here',
  '',
  '.image /tour/static/img/pic.png',
  '',
  '.play -edit prog.go /START OMIT/,/END OMIT/',
  '',
  '* Second page',
  '',
  'Last.',
].join('\n');

describe('buildLesson', () => {
  it('builds pages, ids, hashes, code and image copies', () => {
    const { tourDir, publicDir } = makeDirs();
    fs.writeFileSync(path.join(tourDir, 'static', 'img', 'pic.png'), 'png');
    fs.writeFileSync(
      path.join(tourDir, 'prog.go'),
      [
        'package main',
        '',
        '// START OMIT',
        'func main() {',
        '\tprintln("hi")',
        '}',
        '// END OMIT',
        '',
      ].join('\n'),
    );

    const { lesson, images } = buildLesson('basics', ARTICLE, tourDir, publicDir);

    expect(lesson.title).toBe('Fixture lesson');
    expect(lesson.description).toBe('A description.');
    expect(lesson.pages.map((page) => page.title)).toEqual(['First page', 'Second page']);

    const first = lesson.pages[0];
    expect(first.blocks).toEqual([
      {
        id: 'basics/0/0',
        hash: contentHash('Paragraph with two lines.'),
        kind: 'p',
        text: 'Paragraph with two lines.',
      },
      {
        id: 'basics/0/1',
        hash: listHash(['item one', 'item two']),
        kind: 'list',
        items: ['item one', 'item two'],
      },
      { id: 'basics/0/2', kind: 'pre', text: 'code here' },
      { id: 'basics/0/3', kind: 'image', src: '/tour/images/pic.png' },
    ]);
    expect(first.code).toEqual({
      name: 'prog.go',
      content: 'func main() {\n\tprintln("hi")\n}\n',
    });
    expect(images).toEqual([
      {
        from: path.join(tourDir, 'static', 'img', 'pic.png'),
        to: path.join(publicDir, 'tour', 'images', 'pic.png'),
      },
    ]);
    expect(lesson.pages[1].blocks).toEqual([
      {
        id: 'basics/1/0',
        hash: contentHash('Last.'),
        kind: 'p',
        text: 'Last.',
      },
    ]);
  });

  it('fails when a page has more than one .play', () => {
    const { tourDir, publicDir } = makeDirs();
    fs.writeFileSync(path.join(tourDir, 'a.go'), 'package main\n');
    fs.writeFileSync(path.join(tourDir, 'b.go'), 'package main\n');

    const source = [
      'Fixture',
      'Description',
      '',
      'Author',
      '',
      '* Page',
      '',
      '.play a.go',
      '',
      '.play b.go',
    ].join('\n');

    expect(() => buildLesson('basics', source, tourDir, publicDir)).toThrow(/more than one \.play/);
  });

  it('rejects a .play file outside the tour directory', () => {
    const { tourDir, publicDir } = makeDirs();
    const source = [
      'Fixture',
      'Description',
      '',
      'Author',
      '',
      '* Page',
      '',
      '.play ../outside.go',
    ].join('\n');

    expect(() => buildLesson('basics', source, tourDir, publicDir)).toThrow(/outside/);
  });
});
