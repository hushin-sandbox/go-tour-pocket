import fs from 'node:fs';
import path from 'node:path';
import { LESSON_IDS } from '../../src/shared/content.ts';
import type {
  Block,
  Lesson,
  LessonJa,
  LessonJaBlock,
  LessonJaPage,
} from '../../src/shared/content.ts';
import { contentHash, listHash } from './hash.ts';
import { CONTENT_EN_DIR, CONTENT_JA_DIR } from './paths.ts';

export type ValidationIssue = {
  level: 'error' | 'warning';
  lesson: string;
  blockId?: string;
  message: string;
};

export type ValidationResult = {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  translatedLessons: number;
  missingLessons: string[];
};

/** `` `code` `` で囲まれた部分を出現順に取り出す。閉じていないものは無視する。 */
export function inlineCodeSpans(text: string): string[] {
  const spans: string[] = [];
  let offset = 0;
  for (;;) {
    const start = text.indexOf('`', offset);
    if (start < 0) {
      break;
    }
    const end = text.indexOf('`', start + 1);
    if (end < 0) {
      break;
    }
    spans.push(text.slice(start + 1, end));
    offset = end + 1;
  }
  return spans;
}

/** `[[url][label]]` の url 部分を出現順に取り出す。 */
export function inlineUrls(text: string): string[] {
  const urls: string[] = [];
  const pattern = /\[\[([^\]]*)\]\[[^\]]*\]\]/g;
  for (const match of text.matchAll(pattern)) {
    urls.push(match[1]);
  }
  return urls;
}

function setDifference(
  expected: string[],
  actual: string[],
): { missing: string[]; extra: string[] } {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: [...expectedSet].filter((value) => !actualSet.has(value)).toSorted(),
    extra: [...actualSet].filter((value) => !expectedSet.has(value)).toSorted(),
  };
}

function compareInline(
  english: string,
  japanese: string,
  blockId: string,
  issues: ValidationIssue[],
): void {
  const code = setDifference(inlineCodeSpans(english), inlineCodeSpans(japanese));
  if (code.missing.length > 0 || code.extra.length > 0) {
    issues.push({
      level: 'error',
      lesson: '',
      blockId,
      message:
        'inline code does not match' +
        (code.missing.length > 0 ? ` (missing: ${code.missing.join(', ')})` : '') +
        (code.extra.length > 0 ? ` (extra: ${code.extra.join(', ')})` : ''),
    });
  }

  const urls = setDifference(inlineUrls(english), inlineUrls(japanese));
  if (urls.missing.length > 0 || urls.extra.length > 0) {
    issues.push({
      level: 'error',
      lesson: '',
      blockId,
      message:
        'URLs do not match' +
        (urls.missing.length > 0 ? ` (missing: ${urls.missing.join(', ')})` : '') +
        (urls.extra.length > 0 ? ` (extra: ${urls.extra.join(', ')})` : ''),
    });
  }
}

function englishHash(block: Block & { kind: 'p' | 'list' }): string {
  return block.kind === 'p' ? contentHash(block.text) : listHash(block.items);
}

function validateBlock(
  block: Block,
  jaBlock: LessonJaBlock | undefined,
  blockId: string,
  issues: ValidationIssue[],
): void {
  if (block.kind === 'pre' || block.kind === 'image') {
    if (jaBlock !== undefined) {
      issues.push({
        level: 'error',
        lesson: '',
        blockId,
        message: `${block.kind} block must not be translated`,
      });
    }
    return;
  }

  const expectedHash = englishHash(block);
  if (block.hash !== expectedHash) {
    issues.push({
      level: 'error',
      lesson: '',
      blockId,
      message: `english hash is stale (${block.hash} != ${expectedHash}); run build`,
    });
  }

  if (jaBlock === undefined) {
    issues.push({
      level: 'error',
      lesson: '',
      blockId,
      message: `missing ${block.kind} translation`,
    });
    return;
  }

  if (jaBlock.hash !== block.hash) {
    issues.push({
      level: 'error',
      lesson: '',
      blockId,
      message: `hash mismatch (english ${block.hash}, ja ${jaBlock.hash}); retranslate`,
    });
  }

  if (block.kind === 'p') {
    if (typeof jaBlock.text !== 'string' || jaBlock.text.trim() === '') {
      issues.push({ level: 'error', lesson: '', blockId, message: 'missing text' });
      return;
    }
    if (jaBlock.items !== undefined) {
      issues.push({ level: 'error', lesson: '', blockId, message: 'p block has items' });
    }
    compareInline(block.text, jaBlock.text, blockId, issues);
    return;
  }

  if (!Array.isArray(jaBlock.items)) {
    issues.push({ level: 'error', lesson: '', blockId, message: 'missing items' });
    return;
  }
  if (jaBlock.text !== undefined) {
    issues.push({ level: 'error', lesson: '', blockId, message: 'list block has text' });
  }
  if (jaBlock.items.length !== block.items.length) {
    issues.push({
      level: 'error',
      lesson: '',
      blockId,
      message: `item count mismatch (english ${block.items.length}, ja ${jaBlock.items.length})`,
    });
  }
  if (jaBlock.items.some((item) => typeof item !== 'string' || item.trim() === '')) {
    issues.push({ level: 'error', lesson: '', blockId, message: 'empty list item' });
  }
  compareInline(block.items.join('\n'), jaBlock.items.join('\n'), blockId, issues);
}

function validatePage(
  english: Lesson['pages'][number],
  japanese: LessonJaPage | undefined,
  pageIndex: number,
  lessonId: string,
  issues: ValidationIssue[],
): void {
  if (japanese === undefined) {
    issues.push({
      level: 'error',
      lesson: lessonId,
      message: `missing page ${pageIndex + 1}`,
    });
    return;
  }
  if (japanese.blocks === null || typeof japanese.blocks !== 'object') {
    issues.push({
      level: 'error',
      lesson: lessonId,
      message: `page ${pageIndex + 1}: blocks is not an object`,
    });
    return;
  }

  const englishIds = new Set<string>();
  for (const block of english.blocks) {
    englishIds.add(block.id);
    validateBlock(block, japanese.blocks[block.id], block.id, issues);
  }

  for (const blockId of Object.keys(japanese.blocks)) {
    if (!englishIds.has(blockId)) {
      issues.push({
        level: 'error',
        lesson: lessonId,
        blockId,
        message: 'unknown block id (english block was removed?)',
      });
    }
  }
}

/** 1 レッスン分の英語と日本語を突き合わせる。ja が無い場合は警告だけ。 */
export function validateLesson(lesson: Lesson, japanese: LessonJa | null): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (japanese === null) {
    issues.push({
      level: 'warning',
      lesson: lesson.id,
      message: 'ja translation not found (only English is available)',
    });
    return issues;
  }

  if (japanese.id !== lesson.id) {
    issues.push({
      level: 'error',
      lesson: lesson.id,
      message: `ja id mismatch (${japanese.id})`,
    });
  }
  if (!Array.isArray(japanese.pages)) {
    issues.push({ level: 'error', lesson: lesson.id, message: 'ja pages is not an array' });
    return issues;
  }
  if (japanese.pages.length !== lesson.pages.length) {
    issues.push({
      level: 'error',
      lesson: lesson.id,
      message: `page count mismatch (english ${lesson.pages.length}, ja ${japanese.pages.length})`,
    });
  }

  for (const [pageIndex, page] of lesson.pages.entries()) {
    validatePage(page, japanese.pages[pageIndex], pageIndex, lesson.id, issues);
  }

  return issues.map((issue) => ({ ...issue, lesson: lesson.id }));
}

function readLessonJson(filePath: string): Lesson {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse の結果は呼び出し側で構造を検証する
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Lesson;
}

function readLessonJaJson(filePath: string): LessonJa {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse の結果は呼び出し側で構造を検証する
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as LessonJa;
}

export function validateContent(
  options: {
    enDir?: string;
    jaDir?: string;
  } = {},
): ValidationResult {
  const enDir = options.enDir ?? CONTENT_EN_DIR;
  const jaDir = options.jaDir ?? CONTENT_JA_DIR;
  const issues: ValidationIssue[] = [];
  const missingLessons: string[] = [];
  let translatedLessons = 0;

  for (const lessonId of LESSON_IDS) {
    const enPath = path.join(enDir, `${lessonId}.json`);
    if (!fs.existsSync(enPath)) {
      issues.push({
        level: 'error',
        lesson: lessonId,
        message: `missing english content: ${path.relative(process.cwd(), enPath)}`,
      });
      continue;
    }

    let lesson: Lesson;
    try {
      lesson = readLessonJson(enPath);
    } catch (error) {
      issues.push({
        level: 'error',
        lesson: lessonId,
        message: `invalid english JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    const jaPath = path.join(jaDir, `${lessonId}.json`);
    let japanese: LessonJa | null = null;
    if (fs.existsSync(jaPath)) {
      translatedLessons++;
      try {
        japanese = readLessonJaJson(jaPath);
      } catch (error) {
        issues.push({
          level: 'error',
          lesson: lessonId,
          message: `invalid ja JSON: ${error instanceof Error ? error.message : String(error)}`,
        });
        continue;
      }
    } else {
      missingLessons.push(lessonId);
    }

    issues.push(...validateLesson(lesson, japanese));
  }

  if (fs.existsSync(jaDir)) {
    const known = new Set<string>(LESSON_IDS);
    for (const entry of fs.readdirSync(jaDir)) {
      if (entry.endsWith('.json') && !known.has(entry.slice(0, -'.json'.length))) {
        issues.push({
          level: 'warning',
          lesson: entry.slice(0, -'.json'.length),
          message: 'unknown ja lesson file',
        });
      }
    }
  }

  return {
    issues,
    errorCount: issues.filter((issue) => issue.level === 'error').length,
    warningCount: issues.filter((issue) => issue.level === 'warning').length,
    translatedLessons,
    missingLessons,
  };
}
