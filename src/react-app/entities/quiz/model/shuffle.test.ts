import type { QuizQuestion } from '@/shared/content';
import { shuffleQuiz } from './shuffle';

function makeQuestions(): QuizQuestion[] {
  return [
    {
      id: 'q1',
      pageIndex: 0,
      prompt: '問題 1',
      choices: ['a', 'b', 'c', 'd'],
      answer: 2,
      explanation: '解説 1',
    },
    {
      id: 'q2',
      pageIndex: 1,
      prompt: '問題 2',
      choices: ['e', 'f', 'g'],
      answer: 0,
      explanation: '解説 2',
    },
  ];
}

/** 常に同じ値を返す乱数。Fisher–Yates の動きを固定する。 */
function fixedRandom(value: number): () => number {
  return () => value;
}

describe('shuffleQuiz', () => {
  it('shuffles questions and choices deterministically', () => {
    const result = shuffleQuiz(makeQuestions(), fixedRandom(0));

    expect(result).toEqual([
      {
        id: 'q2',
        pageIndex: 1,
        prompt: '問題 2',
        choices: ['f', 'g', 'e'],
        answer: 2,
        explanation: '解説 2',
      },
      {
        id: 'q1',
        pageIndex: 0,
        prompt: '問題 1',
        choices: ['b', 'c', 'd', 'a'],
        answer: 1,
        explanation: '解説 1',
      },
    ]);
  });

  it('keeps the answer pointing at the same choice', () => {
    for (const random of [fixedRandom(0), fixedRandom(0.35), fixedRandom(0.999)]) {
      const questions = makeQuestions();
      const result = shuffleQuiz(questions, random);

      expect(result.map((question) => question.id).toSorted()).toEqual(['q1', 'q2']);
      for (const question of result) {
        const original = questions.find((item) => item.id === question.id);
        expect(original).toBeDefined();
        expect(question.choices[question.answer]).toBe(original?.choices[original.answer]);
        expect(question.choices.toSorted()).toEqual((original?.choices ?? []).toSorted());
      }
    }
  });

  it('does not mutate the input', () => {
    const questions = makeQuestions();
    const snapshot = structuredClone(questions);

    shuffleQuiz(questions, fixedRandom(0.5));

    expect(questions).toEqual(snapshot);
  });

  it('handles empty input', () => {
    expect(shuffleQuiz([], fixedRandom(0.5))).toEqual([]);
  });
});
