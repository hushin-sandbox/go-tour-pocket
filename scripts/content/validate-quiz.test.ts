import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Lesson, LessonQuiz } from '../../src/shared/content.ts';
import { validateLessonQuiz, validateQuiz } from './validate-quiz.ts';

function makeLesson(): Lesson {
  return {
    id: 'basics',
    title: 'Basics',
    description: 'Description',
    pages: [
      { title: 'Packages', blocks: [] },
      { title: 'Imports', blocks: [] },
      { title: 'Exported names', blocks: [] },
    ],
  };
}

function makeQuiz(): LessonQuiz {
  return {
    id: 'basics',
    questions: [
      {
        id: 'exported-names',
        pageIndex: 2,
        prompt: '大文字で始まる名前はどれですか？',
        choices: ['`math.pi`', '`math.Pi`', '`math._Pi`'],
        answer: 1,
        explanation: '大文字で始まる名前がエクスポートされます。',
      },
      {
        id: 'zero-value',
        pageIndex: 0,
        prompt: 'このプログラムの出力はどれですか？',
        code: 'package main\n\nfunc main() {}\n',
        choices: ['0', '1', 'nil'],
        answer: 0,
        explanation: 'ゼロ値は 0 です。',
      },
    ],
  };
}

function messagesOf(lesson: Lesson, quiz: LessonQuiz): string[] {
  return validateLessonQuiz(lesson, quiz).map((issue) => issue.message);
}

function errorsOf(lesson: Lesson, quiz: LessonQuiz): string[] {
  return validateLessonQuiz(lesson, quiz)
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
  quiz: Record<string, unknown>,
): {
  enDir: string;
  quizDir: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-tour-quiz-'));
  tempDirs.push(root);
  const enDir = path.join(root, 'en');
  const quizDir = path.join(root, 'quiz');
  fs.mkdirSync(enDir);
  fs.mkdirSync(quizDir);
  for (const [id, lesson] of Object.entries(en)) {
    fs.writeFileSync(path.join(enDir, `${id}.json`), JSON.stringify(lesson));
  }
  for (const [id, data] of Object.entries(quiz)) {
    fs.writeFileSync(path.join(quizDir, `${id}.json`), JSON.stringify(data));
  }
  return { enDir, quizDir };
}

describe('validateLessonQuiz', () => {
  it('accepts valid questions', () => {
    expect(messagesOf(makeLesson(), makeQuiz())).toEqual([]);
  });

  it('detects an id mismatch', () => {
    const quiz = makeQuiz();
    quiz.id = 'welcome';
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/quiz id mismatch/);
  });

  it('detects empty questions', () => {
    const quiz = makeQuiz();
    quiz.questions = [];
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/questions is empty/);
  });

  it('detects a duplicate id', () => {
    const quiz = makeQuiz();
    quiz.questions.push({ ...quiz.questions[0] });
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/duplicate id: exported-names/);
  });

  it('rejects ids that are not kebab-case', () => {
    const quiz = makeQuiz();
    quiz.questions[0].id = 'Exported_Names';
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/id is not kebab-case/);
  });

  it('detects a page index that does not exist', () => {
    const quiz = makeQuiz();
    quiz.questions[0].pageIndex = 9;
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/pageIndex 9 is out of range/);
  });

  it('detects a negative page index', () => {
    const quiz = makeQuiz();
    quiz.questions[0].pageIndex = -1;
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/pageIndex -1 is out of range/);
  });

  it('detects an empty prompt', () => {
    const quiz = makeQuiz();
    quiz.questions[0].prompt = '   ';
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/prompt is empty/);
  });

  it('detects an empty explanation', () => {
    const quiz = makeQuiz();
    quiz.questions[0].explanation = '';
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/explanation is empty/);
  });

  it('detects too few choices', () => {
    const quiz = makeQuiz();
    quiz.questions[0].choices = ['`math.pi`', '`math.Pi`'];
    quiz.questions[0].answer = 1;
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/choices must have 3 to 4 items/);
  });

  it('detects too many choices', () => {
    const quiz = makeQuiz();
    quiz.questions[0].choices = ['`math.pi`', '`math.Pi`', '`math._Pi`', '`math.Pi_`', '`math.PI`'];
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/choices must have 3 to 4 items/);
  });

  it('detects an empty choice', () => {
    const quiz = makeQuiz();
    quiz.questions[0].choices[2] = ' ';
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/choices\[2\] is empty/);
  });

  it('detects duplicate choices', () => {
    const quiz = makeQuiz();
    quiz.questions[0].choices[2] = '`math.pi`';
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/duplicate choice: `math.pi`/);
  });

  it('detects an answer out of range', () => {
    const quiz = makeQuiz();
    quiz.questions[0].answer = 3;
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/answer 3 is out of range/);
  });

  it('detects an odd number of backticks', () => {
    const quiz = makeQuiz();
    quiz.questions[0].prompt = '`0 false の出力は？';
    quiz.questions[0].choices[2] = '`math._Pi';
    const errors = errorsOf(makeLesson(), quiz).join('\n');
    expect(errors).toMatch(/prompt has an odd number of backticks/);
    expect(errors).toMatch(/choices\[2\] has an odd number of backticks/);
  });

  it('detects an empty code span', () => {
    const quiz = makeQuiz();
    quiz.questions[0].explanation = 'ゼロ値は `` です。';
    quiz.questions[0].choices[0] = '``';
    const errors = errorsOf(makeLesson(), quiz).join('\n');
    expect(errors).toMatch(/explanation has an empty code span/);
    expect(errors).toMatch(/choices\[0\] has an empty code span/);
  });

  it('detects code without a trailing newline', () => {
    const quiz = makeQuiz();
    quiz.questions[1].code = 'package main';
    expect(errorsOf(makeLesson(), quiz).join('\n')).toMatch(/code must end with a newline/);
  });

  it('warns when the correct choice is uniquely the longest', () => {
    const quiz = makeQuiz();
    quiz.questions[0].choices = ['`math.pi`', '`math.Pi`（大文字で始まる）', '`math._Pi`'];
    const issues = validateLessonQuiz(makeLesson(), quiz);

    const warnings = issues.filter((issue) => issue.level === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/the correct choice is longer than every other choice/);
    expect(errorsOf(makeLesson(), quiz)).toEqual([]);
  });

  it('does not warn when the correct choice shares the longest length', () => {
    const quiz = makeQuiz();
    quiz.questions[0].choices = ['`math.pi`', '`math.Pi`', '`math.PI_`'];
    const issues = validateLessonQuiz(makeLesson(), quiz);

    expect(issues.filter((issue) => issue.level === 'warning')).toEqual([]);
  });
});

describe('validateQuiz', () => {
  it('treats a missing directory as no quiz', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-tour-quiz-'));
    tempDirs.push(root);

    const result = validateQuiz({
      enDir: path.join(root, 'en'),
      quizDir: path.join(root, 'quiz'),
    });

    expect(result).toMatchObject({
      errorCount: 0,
      warningCount: 0,
      quizLessons: 0,
      quizQuestions: 0,
    });
  });

  it('accepts valid files and counts them', () => {
    const dirs = makeTempContent({ basics: makeLesson() }, { basics: makeQuiz() });

    const result = validateQuiz(dirs);

    expect(result.issues).toEqual([]);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.quizLessons).toBe(1);
    expect(result.quizQuestions).toBe(2);
  });

  it('detects a file name that does not match the id', () => {
    const dirs = makeTempContent(
      { basics: makeLesson() },
      { basics: { ...makeQuiz(), id: 'welcome' } },
    );

    const messages = validateQuiz(dirs)
      .issues.map((issue) => issue.message)
      .join('\n');
    expect(messages).toMatch(/id does not match the file name/);
    expect(messages).toMatch(/quiz id mismatch/);
  });

  it('detects an unknown lesson file', () => {
    const dirs = makeTempContent({ basics: makeLesson() }, { basics: makeQuiz() });
    fs.writeFileSync(path.join(dirs.quizDir, 'unknown.json'), JSON.stringify(makeQuiz()));

    const result = validateQuiz(dirs);

    expect(result.issues.map((issue) => issue.message).join('\n')).toMatch(/unknown lesson file/);
    expect(result.quizLessons).toBe(1);
  });

  it('detects invalid JSON', () => {
    const dirs = makeTempContent({ basics: makeLesson() }, {});
    fs.writeFileSync(path.join(dirs.quizDir, 'basics.json'), '{ not json');

    const result = validateQuiz(dirs);

    expect(result.issues.map((issue) => issue.message).join('\n')).toMatch(/invalid JSON/);
    expect(result.errorCount).toBe(1);
  });

  it('detects a missing english lesson', () => {
    const dirs = makeTempContent({}, { basics: makeQuiz() });

    const result = validateQuiz(dirs);

    expect(result.issues.map((issue) => issue.message).join('\n')).toMatch(
      /missing english content/,
    );
  });
});
