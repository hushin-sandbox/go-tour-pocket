import type { QuizQuestion } from '@/shared/content';

/** 0 以上 1 未満の乱数を返す関数。テストでは固定の値を渡す。 */
export type Random = () => number;

/** Fisher–Yates。元の配列は変えず、新しい配列を返す。 */
function shuffled<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapWith = Math.floor(random() * (index + 1));
    const current = result[index];
    result[index] = result[swapWith];
    result[swapWith] = current;
  }
  return result;
}

/**
 * 表示順を作る。問題の順序と各問の選択肢の順序を入れ替え、`answer` を
 * 新しい choices の index に付け替える。
 *
 * 毎回の表示でシャッフルすると「答えはいつも 2 番目」のような手がかりが消える。
 * 呼ぶのは読み込み側で 1 回だけにして、表示側は渡された順のまま描く（story を決定的にする）。
 */
export function shuffleQuiz(
  questions: readonly QuizQuestion[],
  random: Random = Math.random,
): QuizQuestion[] {
  return shuffled(questions, random).map((question) => {
    const answer = question.choices[question.answer];
    const choices = shuffled(question.choices, random);
    return { ...question, choices, answer: choices.indexOf(answer) };
  });
}
