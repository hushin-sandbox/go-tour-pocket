import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import type { LoadedLesson } from '@/react-app/entities/lesson';
import type { QuizQuestion } from '@/shared/content';
import { QuizPageView } from './QuizPage';

const lesson: LoadedLesson = {
  id: 'basics',
  title: { en: 'Packages, variables, and functions.', ja: 'パッケージ、変数、関数' },
  description: { en: 'Learn the basics.', ja: '基本を学びます。' },
  pages: [
    { title: { en: 'Zero values', ja: 'ゼロ値' }, blocks: [] },
    { title: { en: 'Short variable declarations', ja: '短い変数宣言' }, blocks: [] },
    { title: { en: 'Exported names', ja: 'エクスポートされた名前' }, blocks: [] },
  ],
};

const questions: QuizQuestion[] = [
  {
    id: 'exported-names',
    pageIndex: 2,
    prompt: '他のパッケージから参照できる（エクスポートされた）名前はどれですか？',
    choices: ['`math.pi`', '`math.Pi`', '`math._Pi`', '`math.PI_`'],
    answer: 1,
    explanation:
      'Go では大文字で始まる名前がエクスポートされます。`pi` は小文字で始まるので、パッケージの外からは参照できません。',
  },
  {
    id: 'zero-value',
    pageIndex: 0,
    prompt: 'このプログラムの出力はどれですか？',
    code: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tvar i int\n\tfmt.Println(i)\n}\n',
    choices: ['`int`', '`nil`', '`0`'],
    answer: 2,
    explanation: '宣言しただけの変数はゼロ値で初期化されます。`int` のゼロ値は `0` です。',
  },
  {
    id: 'short-declaration',
    pageIndex: 1,
    prompt: '`:=` を使える場所はどこですか？',
    choices: ['関数の中だけ', 'パッケージレベルだけ', '関数の中とパッケージレベルの両方'],
    answer: 0,
    explanation: '`:=` は短い変数宣言で、関数の中でだけ使えます。',
  },
];

const meta = {
  component: QuizPageView,
  args: { lesson, questions },
} satisfies Meta<typeof QuizPageView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 正解を選ぶと、正解の表示・解説・根拠ページへのリンクが出る。 */
export const CorrectAnswer: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('確認問題')).toBeVisible();
    await expect(canvas.getByText('問 1 / 3')).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'math.Pi' }));

    await expect(await canvas.findByText('正解')).toBeVisible();
    await expect(
      canvas.getByText(/Go では大文字で始まる名前がエクスポートされます。/),
    ).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'ページ 3『エクスポートされた名前』を読み返す' }),
    ).toHaveAttribute('href', '/tour/basics/3');
    // 正解の選択肢は色だけでなく、読み上げ用のテキストでも分かる
    await expect(canvas.getByRole('button', { name: /正解の選択肢/ })).toHaveTextContent('math.Pi');
    await expect(canvas.getByRole('button', { name: 'math.pi' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: '次の問題' })).toBeEnabled();
  },
};

/** 不正解を選ぶと、不正解の表示と読み返しリンクが出る。 */
export const WrongAnswer: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'math.pi' }));

    await expect(await canvas.findByText('不正解')).toBeVisible();
    await expect(
      canvas.getByText(/小文字で始まるので、パッケージの外からは参照できません。/),
    ).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'ページ 3『エクスポートされた名前』を読み返す' }),
    ).toHaveAttribute('href', '/tour/basics/3');
    // 正解の選択肢が強調される
    await expect(canvas.getByRole('button', { name: /正解の選択肢/ })).toHaveTextContent('math.Pi');
    await expect(canvas.getByRole('button', { name: 'math.pi' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: '次の問題' })).toBeEnabled();
  },
};

/** 最後まで進むと、スコアと間違えた問題の一覧が出る。 */
export const Result: Story = {
  play: async ({ canvas, userEvent }) => {
    // 1 問目: 正解
    await userEvent.click(canvas.getByRole('button', { name: 'math.Pi' }));
    await userEvent.click(canvas.getByRole('button', { name: '次の問題' }));

    // 2 問目: コードを添えた問題。不正解を選ぶ
    await expect(
      await canvas.findByRole('heading', { name: 'このプログラムの出力はどれですか？' }),
    ).toBeVisible();
    await expect(canvas.getByText(/fmt.Println\(i\)/)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'nil' }));
    await userEvent.click(canvas.getByRole('button', { name: '次の問題' }));

    // 3 問目: 正解して結果へ
    await expect(
      await canvas.findByRole('heading', { name: /を使える場所はどこですか/ }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: '関数の中だけ' }));
    await userEvent.click(canvas.getByRole('button', { name: '結果を見る' }));

    await expect(await canvas.findByRole('heading', { name: '3 問中 2 問正解' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: '間違えた問題' })).toBeVisible();
    await expect(canvas.getByText('このプログラムの出力はどれですか？')).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'ページ 1『ゼロ値』を読み返す' }),
    ).toHaveAttribute('href', '/tour/basics/1');
    // 正解した問題は間違えた問題の一覧には出さない
    await expect(
      canvas.queryByText('他のパッケージから参照できる（エクスポートされた）名前はどれですか？'),
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: '間違えた問題を解き直す' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'もう一度' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'レッスン一覧へ' })).toHaveAttribute('href', '/');
  },
};

/** 解き直しでは、間違えた問題だけを出し直す。 */
export const RetryWrong: Story = {
  play: async ({ canvas, userEvent }) => {
    // 1 問目: 正解
    await userEvent.click(canvas.getByRole('button', { name: 'math.Pi' }));
    await userEvent.click(canvas.getByRole('button', { name: '次の問題' }));

    // 2 問目: 不正解
    await expect(
      await canvas.findByRole('heading', { name: 'このプログラムの出力はどれですか？' }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'nil' }));
    await userEvent.click(canvas.getByRole('button', { name: '次の問題' }));

    // 3 問目: 正解
    await expect(
      await canvas.findByRole('heading', { name: /を使える場所はどこですか/ }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: '関数の中だけ' }));
    await userEvent.click(canvas.getByRole('button', { name: '結果を見る' }));

    await userEvent.click(await canvas.findByRole('button', { name: '間違えた問題を解き直す' }));

    // 間違えた 1 問だけが、先頭から出る
    await expect(
      await canvas.findByRole('heading', { name: 'このプログラムの出力はどれですか？' }),
    ).toBeVisible();
    await expect(canvas.getByText('問 1 / 1')).toBeVisible();
    await expect(
      canvas.queryByText('他のパッケージから参照できる（エクスポートされた）名前はどれですか？'),
    ).not.toBeInTheDocument();

    // 解き直して正解すると、全問正解の結果になる
    await userEvent.click(canvas.getByRole('button', { name: '0' }));
    await userEvent.click(canvas.getByRole('button', { name: '結果を見る' }));

    await expect(await canvas.findByRole('heading', { name: '1 問中 1 問正解' })).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: '間違えた問題を解き直す' }),
    ).not.toBeInTheDocument();
  },
};

/** 全問正解なら、間違えた問題の一覧と解き直しは出さない。 */
export const AllCorrect: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'math.Pi' }));
    await userEvent.click(canvas.getByRole('button', { name: '次の問題' }));

    await userEvent.click(await canvas.findByRole('button', { name: '0' }));
    await userEvent.click(canvas.getByRole('button', { name: '次の問題' }));

    await userEvent.click(await canvas.findByRole('button', { name: '関数の中だけ' }));
    await userEvent.click(canvas.getByRole('button', { name: '結果を見る' }));

    await expect(await canvas.findByRole('heading', { name: '3 問中 3 問正解' })).toBeVisible();
    await expect(canvas.queryByRole('heading', { name: '間違えた問題' })).not.toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: '間違えた問題を解き直す' }),
    ).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'もう一度' })).toBeVisible();
  },
};

/** 空白を含むコード（`0 false` など）も、バッククォートを出さずにコードとして描く。 */
export const CodeWithSpaces: Story = {
  args: {
    questions: [
      {
        id: 'map-missing-key',
        pageIndex: 0,
        prompt: '`v, ok := m["Go"]` の結果を `fmt.Println(v, ok)` で表示すると？',
        choices: ['`0 true`', '`nil false`', '`0 false`'],
        answer: 2,
        explanation: 'キーが無いとき、値はゼロ値 `0`、`ok` は `false` です。',
      },
    ],
  },
  play: async ({ canvas }) => {
    const choice = canvas.getByRole('button', { name: '0 false' });
    await expect(choice.querySelector('code')).toHaveTextContent(/^0 false$/);
    await expect(canvas.queryByText(/`/)).toBeNull();
  },
};
