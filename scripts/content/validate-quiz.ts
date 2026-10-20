import fs from 'node:fs';
import path from 'node:path';
import { LESSON_IDS } from '../../src/shared/content.ts';
import type { Lesson } from '../../src/shared/content.ts';
import { quizTextProblem } from '../../src/shared/quiz-text.ts';
import { CONTENT_EN_DIR, CONTENT_QUIZ_DIR } from './paths.ts';

/**
 * `content/quiz/<lesson>.json`（確認問題）の検証。
 *
 * 確認問題は手書きのファイルなので、構造の誤り（範囲外のページ、選択肢の重複、
 * 正解の index 違いなど）は画面ではなくここで止める。誤りが無くても、正解だけが
 * 長い選択肢は「長さで当てられる」手がかりになるので warning にする。
 */

/** 選択肢の数。2 択では当てずっぽうでも当たるので 3 以上にする。 */
export const QUIZ_MIN_CHOICES = 3;
export const QUIZ_MAX_CHOICES = 4;

const KEBAB_CASE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type QuizIssue = {
  level: 'error' | 'warning';
  lesson: string;
  /** 問題に紐づかない issue では省略する。 */
  questionId?: string;
  message: string;
};

export type QuizValidationResult = {
  issues: QuizIssue[];
  errorCount: number;
  warningCount: number;
  /** 検証したファイル（レッスン）の数。 */
  quizLessons: number;
  /** 問題の総数。 */
  quizQuestions: number;
};

/**
 * JSON.parse 直後の確認問題。フィールドの型は検証しながら確かめるので unknown で受ける。
 * 検証を通ったあとの形は `src/shared/content.ts` の `LessonQuiz`。
 */
export type QuizInput = {
  id?: unknown;
  questions?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 検証に使う範囲だけを確かめる（本文の構造は validate-content が見る）。 */
function isLesson(value: unknown): value is Lesson {
  return isRecord(value) && typeof value.id === 'string' && Array.isArray(value.pages);
}

/** 1 レッスン分の確認問題を、対応する英語のレッスン構造と突き合わせる。 */
export function validateLessonQuiz(lesson: Lesson, quiz: QuizInput): QuizIssue[] {
  const issues: QuizIssue[] = [];
  const push = (issue: Omit<QuizIssue, 'lesson'>): void => {
    issues.push({ ...issue, lesson: lesson.id });
  };

  if (typeof quiz.id !== 'string') {
    push({ level: 'error', message: 'id is not a string' });
  } else if (quiz.id !== lesson.id) {
    push({ level: 'error', message: `quiz id mismatch (${quiz.id})` });
  }

  if (!Array.isArray(quiz.questions)) {
    push({ level: 'error', message: 'questions is not an array' });
    return issues;
  }

  if (quiz.questions.length === 0) {
    push({ level: 'error', message: 'questions is empty' });
    return issues;
  }

  const seenIds = new Set<string>();
  for (const [questionIndex, rawQuestion] of quiz.questions.entries()) {
    if (!isRecord(rawQuestion)) {
      push({ level: 'error', message: `questions[${questionIndex}] is not an object` });
      continue;
    }

    const id = typeof rawQuestion.id === 'string' ? rawQuestion.id : '';
    if (id === '') {
      push({ level: 'error', message: `questions[${questionIndex}] has no id` });
    } else {
      if (!KEBAB_CASE_ID.test(id)) {
        push({
          level: 'error',
          questionId: id,
          message: `id is not kebab-case: ${id} (use lower-case letters, digits and "-")`,
        });
      }
      if (seenIds.has(id)) {
        push({ level: 'error', questionId: id, message: `duplicate id: ${id}` });
      }
      seenIds.add(id);
    }

    // 画面は `` ` `` の対でコードを切り出す（src/shared/quiz-text.ts）。崩れた記法はここで止める。
    const pushTextProblem = (field: string, value: string): void => {
      const problem = quizTextProblem(value);
      if (problem === 'unpaired') {
        push({
          level: 'error',
          questionId: id,
          message: `${field} has an odd number of backticks`,
        });
      } else if (problem === 'empty-code') {
        push({ level: 'error', questionId: id, message: `${field} has an empty code span` });
      }
    };

    const pageIndex = rawQuestion.pageIndex;
    if (typeof pageIndex !== 'number' || !Number.isInteger(pageIndex)) {
      push({ level: 'error', questionId: id, message: 'pageIndex is not an integer' });
    } else if (pageIndex < 0 || pageIndex >= lesson.pages.length) {
      push({
        level: 'error',
        questionId: id,
        message:
          `pageIndex ${pageIndex} is out of range ` +
          `(the lesson has ${lesson.pages.length} pages, numbered from 0)`,
      });
    }

    for (const field of ['prompt', 'explanation'] as const) {
      const value = rawQuestion[field];
      if (typeof value !== 'string' || value.trim() === '') {
        push({ level: 'error', questionId: id, message: `${field} is empty` });
        continue;
      }
      pushTextProblem(field, value);
    }

    const code = rawQuestion.code;
    if (code !== undefined) {
      if (typeof code !== 'string') {
        push({ level: 'error', questionId: id, message: 'code is not a string' });
      } else if (!code.endsWith('\n')) {
        push({
          level: 'error',
          questionId: id,
          message: 'code must end with a newline (gofmt keeps the trailing newline)',
        });
      }
    }

    const choices = rawQuestion.choices;
    if (!Array.isArray(choices)) {
      push({ level: 'error', questionId: id, message: 'choices is not an array' });
      continue;
    }

    if (choices.length < QUIZ_MIN_CHOICES || choices.length > QUIZ_MAX_CHOICES) {
      push({
        level: 'error',
        questionId: id,
        message:
          `choices must have ${QUIZ_MIN_CHOICES} to ${QUIZ_MAX_CHOICES} items ` +
          `(has ${choices.length})`,
      });
    }

    const seenChoices = new Set<string>();
    for (const [choiceIndex, rawChoice] of choices.entries()) {
      if (typeof rawChoice !== 'string' || rawChoice.trim() === '') {
        push({ level: 'error', questionId: id, message: `choices[${choiceIndex}] is empty` });
        continue;
      }
      if (seenChoices.has(rawChoice)) {
        push({ level: 'error', questionId: id, message: `duplicate choice: ${rawChoice}` });
      }
      seenChoices.add(rawChoice);
      pushTextProblem(`choices[${choiceIndex}]`, rawChoice);
    }

    const answer = rawQuestion.answer;
    if (typeof answer !== 'number' || !Number.isInteger(answer)) {
      push({ level: 'error', questionId: id, message: 'answer is not an integer' });
      continue;
    }
    if (answer < 0 || answer >= choices.length) {
      push({
        level: 'error',
        questionId: id,
        message:
          `answer ${answer} is out of range ` +
          `(choices has ${choices.length} items, numbered from 0)`,
      });
      continue;
    }

    // 正解だけが最長だと、長さが正解の手がかりになる。
    const answerChoice = choices[answer];
    const answerLength = typeof answerChoice === 'string' ? answerChoice.length : 0;
    const otherChoices = choices.filter((_, choiceIndex) => choiceIndex !== answer);
    const isUniqueLongest =
      typeof answerChoice === 'string' &&
      otherChoices.length > 0 &&
      otherChoices.every((choice) => typeof choice === 'string' && answerLength > choice.length);
    if (isUniqueLongest) {
      push({
        level: 'warning',
        questionId: id,
        message:
          `the correct choice is longer than every other choice ` +
          `(${answerLength} characters); length is a hint`,
      });
    }
  }

  return issues;
}

function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * `content/quiz` 全体を検証する。ディレクトリが無ければ「問題なし」として
 * 空の結果を返す（呼び出し側でメッセージを出す）。
 */
export function validateQuiz(
  options: { enDir?: string; quizDir?: string } = {},
): QuizValidationResult {
  const enDir = options.enDir ?? CONTENT_EN_DIR;
  const quizDir = options.quizDir ?? CONTENT_QUIZ_DIR;
  const issues: QuizIssue[] = [];
  let quizLessons = 0;
  let quizQuestions = 0;

  if (!fs.existsSync(quizDir)) {
    return { issues, errorCount: 0, warningCount: 0, quizLessons: 0, quizQuestions: 0 };
  }

  const known = new Set<string>(LESSON_IDS);
  for (const entry of fs.readdirSync(quizDir).toSorted()) {
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

    let lesson: unknown;
    let quiz: unknown;
    try {
      lesson = readJsonFile(enPath);
      quiz = readJsonFile(path.join(quizDir, entry));
    } catch (error) {
      issues.push({
        level: 'error',
        lesson: fileLessonId,
        message: `invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    if (!isRecord(quiz)) {
      issues.push({ level: 'error', lesson: fileLessonId, message: 'quiz file is not an object' });
      continue;
    }

    if (quiz.id !== fileLessonId) {
      issues.push({
        level: 'error',
        lesson: fileLessonId,
        message: `id does not match the file name (${String(quiz.id)} != ${fileLessonId})`,
      });
    }

    if (!isLesson(lesson)) {
      issues.push({
        level: 'error',
        lesson: fileLessonId,
        message: 'invalid english content (id or pages is malformed)',
      });
      continue;
    }

    issues.push(...validateLessonQuiz(lesson, quiz));

    quizLessons++;
    if (Array.isArray(quiz.questions)) quizQuestions += quiz.questions.length;
  }

  return {
    issues,
    errorCount: issues.filter((issue) => issue.level === 'error').length,
    warningCount: issues.filter((issue) => issue.level === 'warning').length,
    quizLessons,
    quizQuestions,
  };
}

/** validate.ts 向けの 1 行表示。 */
export function formatQuizIssue(issue: QuizIssue): string {
  const location =
    issue.questionId === undefined ? `[${issue.lesson}]` : `[${issue.lesson} ${issue.questionId}]`;
  return `${issue.level} ${location} ${issue.message}`;
}
