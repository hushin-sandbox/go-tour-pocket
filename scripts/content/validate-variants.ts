import fs from 'node:fs';
import path from 'node:path';
import { LESSON_IDS } from '../../src/shared/content.ts';
import type { Lesson, LessonVariants } from '../../src/shared/content.ts';
import { contentHash } from './hash.ts';
import { CONTENT_EN_DIR, CONTENT_VARIANTS_DIR } from './paths.ts';

/**
 * `content/variants/<lesson>.json`（エディタで切り替えるコードパターン）の検証。
 *
 * パターンは原文のコードと対で意味を持つので、原文が更新されたら hash の不一致で
 * 気づけるようにする。生成物ではない手書きのファイルなので、構造の誤りはここで止める。
 */

/** チップに収まる label の長さ。超えたら error ではなく warning（表示はできる）。 */
export const VARIANT_LABEL_MAX_LENGTH = 16;

/** チップの先頭に必ず置く「原文」と衝突するので、variant の id には使わせない。 */
export const RESERVED_VARIANT_ID = 'original';

const KEBAB_CASE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PAGE_INDEX_KEY = /^(?:0|[1-9]\d*)$/;

export type VariantIssue = {
  level: 'error' | 'warning';
  lesson: string;
  /** 0 始まり。ページに紐づかない issue では省略する。 */
  pageIndex?: number;
  variantId?: string;
  message: string;
};

export type VariantsValidationResult = {
  issues: VariantIssue[];
  errorCount: number;
  warningCount: number;
  /** 検証した variants ファイル（レッスン）の数。 */
  variantLessons: number;
  /** パターンを持つページの数。 */
  patternPages: number;
  /** パターンの総数。 */
  patternVariants: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parsePageIndex(key: string): number | null {
  if (!PAGE_INDEX_KEY.test(key)) return null;
  const index = Number(key);
  return Number.isSafeInteger(index) ? index : null;
}

/** 1 レッスン分のパターンを、対応する英語のレッスン構造と突き合わせる。 */
export function validateLessonVariants(lesson: Lesson, variants: LessonVariants): VariantIssue[] {
  const issues: VariantIssue[] = [];
  const push = (issue: Omit<VariantIssue, 'lesson'>): void => {
    issues.push({ ...issue, lesson: lesson.id });
  };

  if (variants.id !== lesson.id) {
    push({ level: 'error', message: `variants id mismatch (${variants.id})` });
  }

  if (!isRecord(variants.pages)) {
    push({ level: 'error', message: 'pages is not an object' });
    return issues;
  }

  const seenPages = new Set<number>();
  for (const [key, rawPage] of Object.entries(variants.pages)) {
    const pageIndex = parsePageIndex(key);
    if (pageIndex === null) {
      push({
        level: 'error',
        message: `page key is not a page index: ${JSON.stringify(key)} (use "0", "1", ...)`,
      });
      continue;
    }
    if (seenPages.has(pageIndex)) {
      push({ level: 'error', pageIndex, message: `duplicate page index: ${key}` });
      continue;
    }
    seenPages.add(pageIndex);

    const page = lesson.pages[pageIndex];
    if (page === undefined) {
      push({
        level: 'error',
        pageIndex,
        message: `page ${pageIndex + 1} does not exist (the lesson has ${lesson.pages.length} pages)`,
      });
      continue;
    }
    if (page.code === undefined) {
      push({
        level: 'error',
        pageIndex,
        message: `page ${pageIndex + 1} has no code (patterns need a .play code block)`,
      });
      continue;
    }

    if (!isRecord(rawPage)) {
      push({ level: 'error', pageIndex, message: 'page entry is not an object' });
      continue;
    }

    const expectedHash = contentHash(page.code.content);
    if (rawPage.hash !== expectedHash) {
      push({
        level: 'error',
        pageIndex,
        message:
          `hash is stale (${rawPage.hash} != ${expectedHash}); ` +
          'the original code changed, update the patterns',
      });
    }

    const rawVariants = rawPage.variants;
    if (!Array.isArray(rawVariants) || rawVariants.length === 0) {
      push({ level: 'error', pageIndex, message: 'variants is empty' });
      continue;
    }

    const seenIds = new Set<string>();
    const seenCodes = new Map<string, string>();
    for (const [variantIndex, rawVariant] of rawVariants.entries()) {
      if (!isRecord(rawVariant)) {
        push({
          level: 'error',
          pageIndex,
          message: `variants[${variantIndex}] is not an object`,
        });
        continue;
      }

      const id = typeof rawVariant.id === 'string' ? rawVariant.id : '';
      if (id === '') {
        push({ level: 'error', pageIndex, message: `variants[${variantIndex}] has no id` });
      } else if (id === RESERVED_VARIANT_ID) {
        push({
          level: 'error',
          pageIndex,
          variantId: id,
          message: `id "${RESERVED_VARIANT_ID}" is reserved for the original code`,
        });
      } else if (!KEBAB_CASE_ID.test(id)) {
        push({
          level: 'error',
          pageIndex,
          variantId: id,
          message: `id is not kebab-case: ${id} (use lower-case letters, digits and "-")`,
        });
      }
      if (id !== '' && seenIds.has(id)) {
        push({ level: 'error', pageIndex, variantId: id, message: `duplicate id: ${id}` });
      }
      if (id !== '') seenIds.add(id);

      const label = typeof rawVariant.label === 'string' ? rawVariant.label : '';
      if (label.trim() === '') {
        push({ level: 'error', pageIndex, variantId: id, message: 'label is empty' });
      } else if (label.length > VARIANT_LABEL_MAX_LENGTH) {
        push({
          level: 'warning',
          pageIndex,
          variantId: id,
          message:
            `label is longer than ${VARIANT_LABEL_MAX_LENGTH} characters ` +
            `(${label.length}): ${label}`,
        });
      }

      const code = typeof rawVariant.code === 'string' ? rawVariant.code : '';
      if (code === '') {
        push({ level: 'error', pageIndex, variantId: id, message: 'code is empty' });
        continue;
      }
      if (!code.endsWith('\n')) {
        push({
          level: 'error',
          pageIndex,
          variantId: id,
          message: 'code must end with a newline (gofmt keeps the trailing newline)',
        });
      }
      if (code === page.code.content) {
        push({
          level: 'error',
          pageIndex,
          variantId: id,
          message: 'code is identical to the original code',
        });
      } else {
        const duplicateOf = seenCodes.get(code);
        if (duplicateOf === undefined) {
          seenCodes.set(code, id);
        } else {
          push({
            level: 'error',
            pageIndex,
            variantId: id,
            message: `code is identical to variant "${duplicateOf}"`,
          });
        }
      }
    }
  }

  return issues;
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * `content/variants` 全体を検証する。ディレクトリが無ければ「パターンなし」として
 * 空の結果を返す（呼び出し側でメッセージを出す）。
 */
export function validateVariants(
  options: { enDir?: string; variantsDir?: string } = {},
): VariantsValidationResult {
  const enDir = options.enDir ?? CONTENT_EN_DIR;
  const variantsDir = options.variantsDir ?? CONTENT_VARIANTS_DIR;
  const issues: VariantIssue[] = [];
  let variantLessons = 0;
  let patternPages = 0;
  let patternVariants = 0;

  if (!fs.existsSync(variantsDir)) {
    return {
      issues,
      errorCount: 0,
      warningCount: 0,
      variantLessons: 0,
      patternPages: 0,
      patternVariants: 0,
    };
  }

  const known = new Set<string>(LESSON_IDS);
  for (const entry of fs.readdirSync(variantsDir).toSorted()) {
    if (!entry.endsWith('.json')) continue;
    const fileLessonId = entry.slice(0, -'.json'.length);

    if (!known.has(fileLessonId)) {
      issues.push({
        level: 'error',
        lesson: fileLessonId,
        message: 'unknown lesson file (not a lesson id)',
      });
      continue;
    }

    const enPath = path.join(enDir, `${fileLessonId}.json`);
    if (!fs.existsSync(enPath)) {
      issues.push({
        level: 'error',
        lesson: fileLessonId,
        message: `missing english content: ${path.relative(process.cwd(), enPath)}`,
      });
      continue;
    }

    let lesson: Lesson;
    let variants: LessonVariants;
    try {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse の結果は検証側で構造を見る
      lesson = readJsonFile(enPath) as Lesson;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse の結果は検証側で構造を見る
      variants = readJsonFile(path.join(variantsDir, entry)) as LessonVariants;
    } catch (error) {
      issues.push({
        level: 'error',
        lesson: fileLessonId,
        message: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    if (!isRecord(variants)) {
      issues.push({
        level: 'error',
        lesson: fileLessonId,
        message: 'pattern file is not an object',
      });
      continue;
    }

    if (variants.id !== fileLessonId) {
      issues.push({
        level: 'error',
        lesson: fileLessonId,
        message: `id does not match the file name (${variants.id} != ${fileLessonId})`,
      });
    }

    const lessonIssues = validateLessonVariants(lesson, variants);
    issues.push(...lessonIssues);

    variantLessons++;
    if (isRecord(variants.pages)) {
      for (const page of Object.values(variants.pages)) {
        if (!isRecord(page) || !Array.isArray(page.variants)) continue;
        patternPages++;
        patternVariants += page.variants.length;
      }
    }
  }

  return {
    issues,
    errorCount: issues.filter((issue) => issue.level === 'error').length,
    warningCount: issues.filter((issue) => issue.level === 'warning').length,
    variantLessons,
    patternPages,
    patternVariants,
  };
}

/** validate.ts 向けの 1 行表示。 */
export function formatVariantIssue(issue: VariantIssue): string {
  const location =
    issue.pageIndex === undefined
      ? `[${issue.lesson}]`
      : `[${issue.lesson} page ${issue.pageIndex + 1}]`;
  const variant = issue.variantId === undefined ? '' : ` (${issue.variantId})`;
  return `${issue.level} ${location}${variant} ${issue.message}`;
}
