import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { LESSON_IDS } from '../../src/shared/content.ts';
import type {
  Block,
  ContentLessonId,
  Lesson,
  LessonIndex,
  Page,
} from '../../src/shared/content.ts';
import { extractCode } from './code.ts';
import { contentHash, listHash } from './hash.ts';
import { CONTENT_EN_DIR, PUBLIC_DIR, ROOT_DIR, TOUR_SOURCE_DIR } from './paths.ts';
import { parseArticle } from './present.ts';
import type { PresentBlock, PresentDoc } from './present.ts';
import { SOURCE_COMMIT, SOURCE_REPOSITORY } from './source.ts';

export type ImageCopy = {
  from: string;
  to: string;
};

export type BuiltLesson = {
  lesson: Lesson;
  images: ImageCopy[];
};

export type BuildResult = {
  lessons: Lesson[];
  index: LessonIndex;
  images: ImageCopy[];
};

export type BuildOptions = {
  tourDir?: string;
  publicDir?: string;
  enDir?: string;
};

function assertInside(root: string, target: string, what: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${what} is outside of ${resolvedRoot}: ${resolvedTarget}`);
  }
}

/** `.image` の src を `_content/tour` 内の実ファイルに解決する。 */
export function resolveImageSource(src: string, tourDir: string): string {
  let relative = src;
  if (relative.startsWith('/tour/')) {
    relative = relative.slice('/tour/'.length);
  } else if (relative.startsWith('/')) {
    relative = relative.slice(1);
  }
  const from = path.resolve(tourDir, relative);
  assertInside(tourDir, from, 'image');
  return from;
}

/** `.image` を `public/tour/images/` に置き、アプリ内パスを返す。 */
export function planImageCopy(
  src: string,
  tourDir: string,
  publicDir: string,
): { copy: ImageCopy; appSrc: string } {
  const from = resolveImageSource(src, tourDir);
  const name = path.basename(from);
  const to = path.join(publicDir, 'tour', 'images', name);
  return {
    copy: { from, to },
    appSrc: path.posix.join('/tour', 'images', name),
  };
}

function blockId(lessonId: string, pageIndex: number, blockIndex: number): string {
  return `${lessonId}/${pageIndex}/${blockIndex}`;
}

function buildPage(
  lessonId: ContentLessonId,
  pageIndex: number,
  presentBlocks: PresentBlock[],
  tourDir: string,
  publicDir: string,
  images: ImageCopy[],
): Page {
  const blocks: Block[] = [];
  let code: Page['code'];

  for (const presentBlock of presentBlocks) {
    switch (presentBlock.kind) {
      case 'text': {
        const text = presentBlock.lines.join(' ');
        const index = blocks.length;
        blocks.push({
          id: blockId(lessonId, pageIndex, index),
          hash: contentHash(text),
          kind: 'p',
          text,
        });
        break;
      }
      case 'list': {
        const index = blocks.length;
        blocks.push({
          id: blockId(lessonId, pageIndex, index),
          hash: listHash(presentBlock.items),
          kind: 'list',
          items: presentBlock.items,
        });
        break;
      }
      case 'pre': {
        const index = blocks.length;
        blocks.push({
          id: blockId(lessonId, pageIndex, index),
          kind: 'pre',
          text: presentBlock.text,
        });
        break;
      }
      case 'image': {
        const index = blocks.length;
        const { copy, appSrc } = planImageCopy(presentBlock.src, tourDir, publicDir);
        images.push(copy);
        blocks.push({
          id: blockId(lessonId, pageIndex, index),
          kind: 'image',
          src: appSrc,
        });
        break;
      }
      case 'play': {
        if (code !== undefined) {
          throw new Error(`${lessonId}: page ${pageIndex} has more than one .play`);
        }
        const filePath = path.resolve(tourDir, presentBlock.file);
        assertInside(tourDir, filePath, '.play file');
        const source = fs.readFileSync(filePath, 'utf8');
        code = {
          name: path.basename(presentBlock.file),
          content: extractCode(source, presentBlock.address),
        };
        break;
      }
    }
  }

  return code === undefined
    ? { title: '', blocks }
    : {
        title: '',
        blocks,
        code,
      };
}

/** 1 レッスン分の `.article` を `Lesson` に変換する。 */
export function buildLesson(
  lessonId: ContentLessonId,
  source: string,
  tourDir: string,
  publicDir: string,
): BuiltLesson {
  const doc: PresentDoc = parseArticle(source);
  const images: ImageCopy[] = [];
  const pages = doc.pages.map((page, pageIndex) => {
    const built = buildPage(lessonId, pageIndex, page.blocks, tourDir, publicDir, images);
    built.title = page.title;
    return built;
  });

  return {
    lesson: {
      id: lessonId,
      title: doc.title,
      description: doc.subtitle,
      pages,
    },
    images,
  };
}

function countBlocks(lesson: Lesson): {
  p: number;
  list: number;
  pre: number;
  image: number;
  code: number;
} {
  const counts = { p: 0, list: 0, pre: 0, image: 0, code: 0 };
  for (const page of lesson.pages) {
    if (page.code !== undefined) {
      counts.code++;
    }
    for (const block of page.blocks) {
      counts[block.kind]++;
    }
  }
  return counts;
}

export function buildContent(options: BuildOptions = {}): BuildResult {
  const tourDir = options.tourDir ?? TOUR_SOURCE_DIR;
  const publicDir = options.publicDir ?? PUBLIC_DIR;
  const enDir = options.enDir ?? CONTENT_EN_DIR;

  if (!fs.existsSync(tourDir)) {
    throw new Error(
      `${tourDir} がありません。先に node scripts/content/fetch.ts を実行してください`,
    );
  }

  fs.mkdirSync(enDir, { recursive: true });
  for (const entry of fs.readdirSync(enDir)) {
    if (entry.endsWith('.json')) {
      fs.rmSync(path.join(enDir, entry));
    }
  }

  const lessons: Lesson[] = [];
  const images = new Map<string, ImageCopy>();

  for (const lessonId of LESSON_IDS) {
    const articlePath = path.join(tourDir, `${lessonId}.article`);
    const source = fs.readFileSync(articlePath, 'utf8');
    const { lesson, images: lessonImages } = buildLesson(lessonId, source, tourDir, publicDir);
    for (const image of lessonImages) {
      const existing = images.get(image.to);
      if (existing !== undefined && existing.from !== image.from) {
        throw new Error(`image path collision: ${image.to}`);
      }
      images.set(image.to, image);
    }

    const outPath = path.join(enDir, `${lessonId}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(lesson, null, 2)}\n`);

    const counts = countBlocks(lesson);
    process.stdout.write(
      `build: ${lessonId.padEnd(12)} pages=${String(lesson.pages.length).padStart(2)} ` +
        `p=${counts.p} list=${counts.list} pre=${counts.pre} image=${counts.image} code=${counts.code}\n`,
    );
    lessons.push(lesson);
  }

  const index: LessonIndex = {
    source: {
      repository: SOURCE_REPOSITORY,
      commit: SOURCE_COMMIT,
    },
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      pageCount: lesson.pages.length,
      pageTitles: lesson.pages.map((page) => page.title),
    })),
  };
  fs.writeFileSync(path.join(enDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  formatJson(enDir);

  const imageDir = path.join(publicDir, 'tour', 'images');
  fs.rmSync(imageDir, { recursive: true, force: true });
  for (const image of images.values()) {
    if (!fs.existsSync(image.from)) {
      throw new Error(`image not found: ${image.from}`);
    }
    fs.mkdirSync(path.dirname(image.to), { recursive: true });
    fs.copyFileSync(image.from, image.to);
  }

  return { lessons, index, images: [...images.values()] };
}

/**
 * 生成物をリポジトリの formatter（oxfmt）に合わせる。
 * oxfmt が無い環境でも build 自体は成功させる。
 */
function formatJson(dir: string): void {
  const binary = path.join(ROOT_DIR, 'node_modules', '.bin', 'oxfmt');
  if (!fs.existsSync(binary)) {
    process.stdout.write('build: oxfmt not found; generated JSON is not formatted\n');
    return;
  }
  execFileSync(binary, [dir], { cwd: ROOT_DIR, stdio: 'ignore' });
}
