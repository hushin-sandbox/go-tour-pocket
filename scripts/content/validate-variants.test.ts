import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Lesson, LessonVariants } from '../../src/shared/content.ts';
import { contentHash } from './hash.ts';
import { CONTENT_VARIANTS_DIR } from './paths.ts';
import { validateLessonVariants, validateVariants } from './validate-variants.ts';

const ORIGINAL_CODE = `package main

import (
	"fmt"
	"math"
)

func main() {
	fmt.Println(math.pi)
}
`;

const FIXED_CODE = `package main

import (
	"fmt"
	"math"
)

func main() {
	fmt.Println(math.Pi)
}
`;

const ROUNDED_CODE = `package main

import (
	"fmt"
	"math"
)

func main() {
	fmt.Printf("%.2f\\n", math.Pi)
}
`;

function makeLesson(): Lesson {
  return {
    id: 'basics',
    title: 'Basics',
    description: 'Description',
    pages: [
      {
        title: 'Exported names',
        blocks: [],
        code: { name: 'exported-names.go', content: ORIGINAL_CODE },
      },
      { title: 'No code', blocks: [] },
    ],
  };
}

function makeVariants(): LessonVariants {
  return {
    id: 'basics',
    pages: {
      '0': {
        hash: contentHash(ORIGINAL_CODE),
        originalNote: '`math.pi` はエクスポートされていないのでコンパイルエラーになります。',
        variants: [
          {
            id: 'fixed',
            label: 'math.Pi に修正',
            note: '大文字の `Pi` にすると動きます。',
            code: FIXED_CODE,
          },
          { id: 'rounded', label: '小数第 2 位まで表示', code: ROUNDED_CODE },
        ],
      },
    },
  };
}

function messagesOf(lesson: Lesson, variants: LessonVariants): string[] {
  return validateLessonVariants(lesson, variants).map((issue) => issue.message);
}

function errorsOf(lesson: Lesson, variants: LessonVariants): string[] {
  return validateLessonVariants(lesson, variants)
    .filter((issue) => issue.level === 'error')
    .map((issue) => issue.message);
}

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempContent(
  en: Record<string, Lesson>,
  variants: Record<string, unknown>,
): {
  enDir: string;
  variantsDir: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-tour-variants-'));
  tempDirs.push(root);
  const enDir = path.join(root, 'en');
  const variantsDir = path.join(root, 'variants');
  fs.mkdirSync(enDir);
  fs.mkdirSync(variantsDir);
  for (const [id, lesson] of Object.entries(en)) {
    fs.writeFileSync(path.join(enDir, `${id}.json`), JSON.stringify(lesson));
  }
  for (const [id, data] of Object.entries(variants)) {
    fs.writeFileSync(path.join(variantsDir, `${id}.json`), JSON.stringify(data));
  }
  return { enDir, variantsDir };
}

describe('validateLessonVariants', () => {
  it('accepts valid patterns', () => {
    expect(messagesOf(makeLesson(), makeVariants())).toEqual([]);
  });

  it('detects an id mismatch', () => {
    const variants = makeVariants();
    variants.id = 'welcome';
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(/variants id mismatch/);
  });

  it('detects a page key that is not an index', () => {
    const variants = makeVariants();
    variants.pages['page-2'] = variants.pages['0'];
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(/page key is not a page index/);
  });

  it('detects a page that does not exist', () => {
    const variants = makeVariants();
    variants.pages['9'] = variants.pages['0'];
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(/page 10 does not exist/);
  });

  it('detects a page without code', () => {
    const variants = makeVariants();
    variants.pages['1'] = { ...variants.pages['0'] };
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(/page 2 has no code/);
  });

  it('detects a stale hash', () => {
    const variants = makeVariants();
    variants.pages['0'].hash = '000000000000';
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(/hash is stale/);
  });

  it('detects empty variants', () => {
    const variants = makeVariants();
    variants.pages['0'].variants = [];
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(/variants is empty/);
  });

  it('detects a duplicate id', () => {
    const variants = makeVariants();
    variants.pages['0'].variants.push({
      id: 'fixed',
      label: 'もう一度',
      code: `${FIXED_CODE}\n`,
    });
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(/duplicate id: fixed/);
  });

  it('rejects the reserved id "original"', () => {
    const variants = makeVariants();
    variants.pages['0'].variants[0].id = 'original';
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(/id "original" is reserved/);
  });

  it('rejects ids that are not kebab-case', () => {
    const variants = makeVariants();
    variants.pages['0'].variants[0].id = 'Fixed_Code';
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(/id is not kebab-case/);
  });

  it('detects an empty label', () => {
    const variants = makeVariants();
    variants.pages['0'].variants[0].label = '   ';
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(/label is empty/);
  });

  it('warns when the label does not fit on a chip', () => {
    const variants = makeVariants();
    variants.pages['0'].variants[0].label = 'これは十六文字を超えるとても長いラベルです';
    const issues = validateLessonVariants(makeLesson(), variants);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('warning');
    expect(issues[0].message).toMatch(/label is longer than 16 characters/);
    expect(errorsOf(makeLesson(), variants)).toEqual([]);
  });

  it('detects code identical to the original', () => {
    const variants = makeVariants();
    variants.pages['0'].variants[0].code = ORIGINAL_CODE;
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(
      /code is identical to the original code/,
    );
  });

  it('detects duplicate code across variants', () => {
    const variants = makeVariants();
    variants.pages['0'].variants[1].code = FIXED_CODE;
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(
      /code is identical to variant "fixed"/,
    );
  });

  it('detects code without a trailing newline', () => {
    const variants = makeVariants();
    variants.pages['0'].variants[0].code = FIXED_CODE.trimEnd();
    expect(errorsOf(makeLesson(), variants).join('\n')).toMatch(/code must end with a newline/);
  });
});

describe('validateVariants', () => {
  it('treats a missing directory as no patterns', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-tour-variants-'));
    tempDirs.push(root);

    const result = validateVariants({
      enDir: path.join(root, 'en'),
      variantsDir: path.join(root, 'variants'),
    });

    expect(result).toMatchObject({
      errorCount: 0,
      warningCount: 0,
      variantLessons: 0,
      patternPages: 0,
      patternVariants: 0,
    });
  });

  it('detects a file name that does not match the id', () => {
    const lesson = makeLesson();
    const dirs = makeTempContent(
      { basics: lesson },
      { basics: { ...makeVariants(), id: 'welcome' } },
    );

    const result = validateVariants(dirs);

    const messages = result.issues.map((issue) => issue.message).join('\n');
    expect(messages).toMatch(/id does not match the file name/);
    expect(messages).toMatch(/variants id mismatch/);
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it('detects an unknown lesson file', () => {
    const lesson = makeLesson();
    const dirs = makeTempContent({ basics: lesson }, { basics: makeVariants() });
    fs.writeFileSync(path.join(dirs.variantsDir, 'unknown.json'), JSON.stringify(makeVariants()));

    const result = validateVariants(dirs);

    expect(result.issues.map((issue) => issue.message).join('\n')).toMatch(/unknown lesson file/);
    expect(result.variantLessons).toBe(1);
    expect(result.patternPages).toBe(1);
    expect(result.patternVariants).toBe(2);
  });

  it('detects invalid JSON', () => {
    const lesson = makeLesson();
    const dirs = makeTempContent({ basics: lesson }, {});
    fs.writeFileSync(path.join(dirs.variantsDir, 'basics.json'), '{ not json');

    const result = validateVariants(dirs);

    expect(result.issues.map((issue) => issue.message).join('\n')).toMatch(/invalid JSON/);
    expect(result.errorCount).toBe(1);
  });

  it('validates the actual content/en and content/variants', () => {
    // パターンは別のエージェントが content/variants に書く。まだ無い間はここで落ちる。
    if (!fs.existsSync(CONTENT_VARIANTS_DIR)) {
      throw new Error(
        'content/variants がまだありません（パターン用のコンテンツ待ち）。' +
          'パターン付きレッスンのファイルが揃うまで、このテストは失敗します。',
      );
    }

    const result = validateVariants();
    const report = result.issues
      .map(
        (issue) =>
          `${issue.level} [${issue.lesson}${
            issue.pageIndex === undefined ? '' : ` page ${issue.pageIndex + 1}`
          }] ${issue.message}`,
      )
      .join('\n');

    expect(report).toBe('');
  });
});
