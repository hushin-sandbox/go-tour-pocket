import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import type { LessonCatalog } from '@/react-app/entities/lesson';
import { PROGRESS_STORAGE_KEY, type Progress } from '@/react-app/entities/progress';
import { HomePage, HomePageView } from './HomePage';

const catalog: LessonCatalog = [
  {
    id: 'welcome',
    title: { en: 'Welcome!', ja: 'ようこそ！' },
    description: { en: 'Welcome to the tour.', ja: 'ツアーへようこそ。' },
    pageTitles: [
      { en: 'Hello, 世界', ja: 'Hello, 世界' },
      { en: 'Go local', ja: 'Go をローカルで' },
    ],
  },
  {
    id: 'basics',
    title: { en: 'Packages, variables, and functions.', ja: 'パッケージ、変数、関数' },
    description: { en: 'Learn the basics.', ja: '基本を学びます。' },
    pageTitles: [
      { en: 'Packages', ja: 'パッケージ' },
      { en: 'Imports', ja: 'インポート' },
      { en: 'Exported names', ja: 'エクスポートされた名前' },
    ],
  },
  {
    id: 'flowcontrol',
    title: { en: 'Flow control statements', ja: 'フロー制御ステートメント' },
    description: { en: 'For, if, switch and defer.', ja: 'for、if、switch、defer。' },
    pageTitles: [
      { en: 'For', ja: 'for' },
      { en: 'If', ja: 'if' },
    ],
  },
  {
    id: 'methods',
    title: { en: 'Methods and interfaces', ja: 'メソッドとインターフェース' },
    description: { en: 'Methods and interfaces.', ja: 'メソッドとインターフェース。' },
    pageTitles: [{ en: 'Methods', ja: 'メソッド' }],
  },
  {
    id: 'generics',
    title: { en: 'Generics', ja: 'ジェネリクス' },
    description: { en: 'Type parameters.', ja: '型パラメータ。' },
    pageTitles: [{ en: 'Type parameters', ja: '型パラメータ' }],
  },
  {
    id: 'concurrency',
    title: { en: 'Concurrency', ja: '並行性' },
    description: { en: 'Goroutines and channels.', ja: 'ゴルーチンとチャネル。' },
    pageTitles: [{ en: 'Goroutines', ja: 'ゴルーチン' }],
  },
];

const noProgress: Progress = { readPages: {}, lastPage: null };

const readingProgress: Progress = {
  readPages: { 'welcome/0': true, 'basics/0': true, 'basics/1': true },
  lastPage: { lessonId: 'basics', pageIndex: 1 },
};

const catalogWithoutJapanese: LessonCatalog = [
  {
    id: 'basics',
    title: { en: 'Packages, variables, and functions.' },
    description: { en: 'Learn the basics.' },
    pageTitles: [{ en: 'Packages' }, { en: 'Imports' }],
  },
];

const meta = {
  component: HomePageView,
  args: { catalog, progress: noProgress },
  beforeEach: () => {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
  },
} satisfies Meta<typeof HomePageView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LessonList: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: 'はじめに' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: '基本' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: '並行性' })).toBeVisible();
    await expect(canvas.getByText('パッケージ、変数、関数')).toBeVisible();

    await userEvent.click(canvas.getByText('パッケージ、変数、関数'));

    await expect(await canvas.findByRole('link', { name: /パッケージ Packages/ })).toBeVisible();
    const progress = canvas.getByRole('progressbar', {
      name: 'パッケージ、変数、関数 の進捗',
    });
    await expect(progress).toHaveAttribute('aria-valuenow', '0');
    await expect(canvas.getByRole('link', { name: 'このアプリについて' })).toHaveAttribute(
      'href',
      '/about',
    );
    await expect(canvas.getByRole('link', { name: 'ライセンス' })).toHaveAttribute(
      'href',
      '/licenses',
    );
  },
};

export const ContinueAndReadPages: Story = {
  args: { progress: readingProgress },
  play: async ({ canvas, userEvent }) => {
    const continueLink = await canvas.findByRole('link', { name: /続きから/ });
    await expect(continueLink).toHaveAttribute('href', '/tour/basics/2');

    const lessonTitle = canvas
      .getAllByText('パッケージ、変数、関数')
      .find((element) => element.closest('summary') !== null);
    if (lessonTitle === undefined) throw new Error('レッスンの summary が見つかりません');
    await userEvent.click(lessonTitle);

    const progress = await canvas.findByRole('progressbar', {
      name: 'パッケージ、変数、関数 の進捗',
    });
    await expect(progress).toHaveAttribute('aria-valuenow', '2');
    await expect(canvas.getAllByText('既読')).toHaveLength(3);
  },
};

export const JapaneseMissing: Story = {
  args: { catalog: catalogWithoutJapanese },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('Packages, variables, and functions.')).toBeVisible();
    await userEvent.click(canvas.getByText('Packages, variables, and functions.'));

    await expect(await canvas.findByRole('link', { name: 'Packages' })).toBeVisible();
  },
};

export const RealContent: Story = {
  render: () => <HomePage />,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('パッケージ、変数、関数')).toBeVisible();
    await expect(canvas.getByRole('heading', { name: '並行性' })).toBeVisible();
  },
};
