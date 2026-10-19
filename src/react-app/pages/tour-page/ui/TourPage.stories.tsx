import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect, waitFor, within } from 'storybook/test';
import type { LessonCatalog, LoadedLesson } from '@/react-app/entities/lesson';
import { PROGRESS_STORAGE_KEY, readProgress } from '@/react-app/entities/progress';
import { DISPLAY_SETTINGS_STORAGE_KEY } from '@/react-app/features/display-mode';
import { TourPageView } from './TourPage';

const lesson: LoadedLesson = {
  id: 'basics',
  title: { en: 'Packages, variables, and functions.', ja: 'パッケージ、変数、関数' },
  description: { en: 'Learn the basics.', ja: '基本を学びます。' },
  pages: [
    {
      title: { en: 'Packages', ja: 'パッケージ' },
      blocks: [
        {
          kind: 'p',
          id: 'basics/0/0',
          hash: 'aaa',
          en: 'Every Go program is made up of packages.',
          ja: 'Go のプログラムはパッケージで構成されます。',
        },
        {
          kind: 'p',
          id: 'basics/0/1',
          hash: 'bbb',
          en: 'Programs start running in package main.',
          ja: 'プログラムは main パッケージから実行が始まります。',
        },
        {
          kind: 'list',
          id: 'basics/0/2',
          hash: 'ccc',
          items: [
            { en: 'The first item.', ja: '1 つ目の項目です。' },
            { en: 'The second item.', ja: '2 つ目の項目です。' },
          ],
        },
        { kind: 'pre', id: 'basics/0/3', text: 'type Point struct {' },
        { kind: 'image', id: 'basics/0/4', src: '/tour/images/tree.png' },
        {
          kind: 'p',
          id: 'basics/0/5',
          hash: 'ggg',
          en: 'Use `package` and *bold* and [[https://go.dev][go.dev]].',
          ja: '`package` と *強調* と [[https://go.dev][go.dev]] を使います。',
        },
      ],
      code: { name: 'main.go', content: 'package main\n\nfunc main() {}\n' },
    },
    {
      title: { en: 'Imports', ja: 'インポート' },
      blocks: [
        {
          kind: 'p',
          id: 'basics/1/0',
          hash: 'ddd',
          en: 'This code groups the imports into a parenthesized block.',
          ja: 'このコードはインポートをまとめて括弧で囲んでいます。',
        },
      ],
    },
    {
      title: { en: 'Exported names', ja: 'エクスポートされた名前' },
      blocks: [
        {
          kind: 'p',
          id: 'basics/2/0',
          hash: 'eee',
          en: 'A name is exported if it begins with a capital letter.',
          ja: '名前が大文字で始まる場合、その名前はエクスポートされます。',
        },
      ],
    },
  ],
};

const catalog: LessonCatalog = [
  {
    id: 'welcome',
    title: { en: 'Welcome!', ja: 'ようこそ！' },
    description: { en: 'Welcome', ja: 'ようこそ' },
    pageTitles: [
      { en: 'Hello, 世界', ja: 'Hello, 世界' },
      { en: 'Go local', ja: 'Go をローカルで' },
    ],
  },
  {
    id: 'basics',
    title: { en: 'Packages, variables, and functions.', ja: 'パッケージ、変数、関数' },
    description: { en: 'Basics', ja: '基本' },
    pageTitles: [
      { en: 'Packages', ja: 'パッケージ' },
      { en: 'Imports', ja: 'インポート' },
      { en: 'Exported names', ja: 'エクスポートされた名前' },
    ],
  },
  {
    id: 'flowcontrol',
    title: { en: 'Flow control statements', ja: 'フロー制御ステートメント' },
    description: { en: 'Flow control', ja: 'フロー制御' },
    pageTitles: [
      { en: 'For', ja: 'for' },
      { en: 'If', ja: 'if' },
    ],
  },
  {
    id: 'generics',
    title: { en: 'Generics', ja: 'ジェネリクス' },
    description: { en: 'Generics', ja: 'ジェネリクス' },
    pageTitles: [{ en: 'Type parameters', ja: '型パラメータ' }],
  },
];

const lessonWithoutJapanese: LoadedLesson = {
  id: 'generics',
  title: { en: 'Generics' },
  description: { en: 'Generics' },
  pages: [
    {
      title: { en: 'Type parameters' },
      blocks: [
        {
          kind: 'p',
          id: 'generics/0/0',
          hash: 'fff',
          en: 'This page has no Japanese translation.',
        },
      ],
    },
  ],
};

const catalogWithoutJapanese: LessonCatalog = [
  {
    id: 'generics',
    title: { en: 'Generics' },
    description: { en: 'Generics' },
    pageTitles: [{ en: 'Type parameters' }],
  },
];

const meta = {
  component: TourPageView,
  args: { lesson, pageIndex: 0, catalog },
  beforeEach: () => {
    localStorage.removeItem(DISPLAY_SETTINGS_STORAGE_KEY);
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
  },
} satisfies Meta<typeof TourPageView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InlineMarkup: Story = {
  play: async ({ canvas }) => {
    const code = canvas.getAllByText('package');
    await expect(code.length).toBeGreaterThan(0);
    await expect(code[0]).toBeVisible();
    await expect(canvas.queryByText('`package`')).not.toBeInTheDocument();
    await expect(canvas.getByText('強調')).toBeVisible();

    const links = canvas.getAllByRole('link', { name: 'go.dev' });
    await expect(links.length).toBeGreaterThan(0);
    await expect(links[0]).toHaveAttribute('href', 'https://go.dev');
    await expect(links[0]).toHaveAttribute('target', '_blank');
  },
};

export const Bilingual: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'パッケージ' })).toBeVisible();
    await expect(canvas.getByText('ページ 1 / 3')).toBeVisible();
    await expect(canvas.getByText('Every Go program is made up of packages.')).toBeVisible();
    await expect(canvas.getByText('Go のプログラムはパッケージで構成されます。')).toBeVisible();
    await expect(canvas.getByText('1 つ目の項目です。')).toBeVisible();
    await expect(canvas.getByText('type Point struct {')).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'コード' })).toBeVisible();
  },
};

export const EnglishOnlyToggle: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '英語のみ' }));
    await expect(
      canvas.queryByText('Go のプログラムはパッケージで構成されます。'),
    ).not.toBeInTheDocument();

    await userEvent.click(canvas.getByText('Every Go program is made up of packages.'));
    await expect(
      await canvas.findByText('Go のプログラムはパッケージで構成されます。'),
    ).toBeVisible();

    await userEvent.click(canvas.getByText('Every Go program is made up of packages.'));
    await waitFor(() =>
      expect(
        canvas.queryByText('Go のプログラムはパッケージで構成されます。'),
      ).not.toBeInTheDocument(),
    );
  },
};

export const JapaneseOnly: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '日本語のみ' }));

    await expect(
      canvas.queryByText('Every Go program is made up of packages.'),
    ).not.toBeInTheDocument();
    await expect(canvas.getByText('Go のプログラムはパッケージで構成されます。')).toBeVisible();
    await expect(canvas.getByText('type Point struct {')).toBeVisible();
  },
};

export const FontSize: Story = {
  play: async ({ canvas, userEvent }) => {
    const article = canvas.getByRole('article');
    await expect(article).toHaveStyle({ fontSize: '18px' });

    await userEvent.click(canvas.getByRole('button', { name: /文字サイズ: 中/ }));
    await expect(article).toHaveStyle({ fontSize: '20px' });

    await userEvent.click(canvas.getByRole('button', { name: /文字サイズ: 大/ }));
    await expect(article).toHaveStyle({ fontSize: '16px' });
  },
};

export const Navigation: Story = {
  play: async ({ canvas }) => {
    const previous = canvas.getByRole('link', { name: /前へ/ });
    const next = canvas.getByRole('link', { name: /次へ/ });

    await expect(previous).toHaveAttribute('href', '/tour/welcome/2');
    await expect(previous).toHaveTextContent('Go をローカルで');
    await expect(next).toHaveAttribute('href', '/tour/basics/2');
    await expect(next).toHaveTextContent('インポート');
  },
};

export const LastPage: Story = {
  args: { pageIndex: 2 },
  play: async ({ canvas }) => {
    const next = canvas.getByRole('link', { name: /次へ/ });
    await expect(next).toHaveAttribute('href', '/tour/flowcontrol/1');
    await expect(next).toHaveTextContent('for');
  },
};

export const TableOfContents: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '目次' }));

    const dialog = await canvas.findByRole('dialog', { name: '目次' });
    await expect(within(dialog).getByRole('link', { name: /インポート/ })).toBeVisible();
    await expect(
      within(dialog).getByRole('link', { name: /フロー制御ステートメント/ }),
    ).toBeVisible();
    await expect(within(dialog).getByRole('link', { name: 'ライセンス' })).toHaveAttribute(
      'href',
      '/licenses',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: '目次を閉じる' }));
    await waitFor(() =>
      expect(canvas.queryByRole('dialog', { name: '目次' })).not.toBeInTheDocument(),
    );
  },
};

export const JapaneseMissing: Story = {
  args: {
    lesson: lessonWithoutJapanese,
    pageIndex: 0,
    catalog: catalogWithoutJapanese,
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '日本語のみ' }));
    await expect(canvas.getByText('This page has no Japanese translation.')).toBeVisible();
  },
};

export const RecordsProgress: Story = {
  play: async () => {
    await waitFor(() =>
      expect(readProgress()).toMatchObject({
        lastPage: { lessonId: 'basics', pageIndex: 0 },
        readPages: { 'basics/0': true },
      }),
    );
  },
};
