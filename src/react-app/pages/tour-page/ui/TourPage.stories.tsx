import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { createRootRoute, createRoute } from '@tanstack/react-router';
import { expect, waitFor, within } from 'storybook/test';
import type { LessonCatalog, LoadedLesson } from '@/react-app/entities/lesson';
import { PROGRESS_STORAGE_KEY, readProgress } from '@/react-app/entities/progress';
import {
  DISPLAY_SETTINGS_STORAGE_KEY,
  DisplaySettingsMenu,
  DisplaySettingsProvider,
} from '@/react-app/features/display-mode';
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
      code: { name: 'main.go', content: 'package main\n\nfunc main() {}\n', variants: [] },
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

/**
 * 実際のアプリでは Header（app/layouts）が表示設定メニューを持つ。
 * Storybook ではレイヤーの向きを守るため、同じ feature のメニューだけを
 * Header と同じ高さのバーに置いて、本文と一緒に描画する。
 */
function LessonPageStory(props: {
  lesson: LoadedLesson;
  pageIndex: number;
  catalog: LessonCatalog;
}) {
  return (
    <DisplaySettingsProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="sticky top-0 z-40 flex h-12 shrink-0 items-center justify-end border-b border-border/70 bg-background px-2">
          <DisplaySettingsMenu />
        </header>
        <TourPageView {...props} />
      </div>
    </DisplaySettingsProvider>
  );
}

// Header の「表示設定」メニューがレッスン画面で出るよう、story をレッスンの
// パスで描画する。実アプリの route は使わず、story 用の細い route を用意する。
const storyRootRoute = createRootRoute();
const storyTourRoute = createRoute({
  getParentRoute: () => storyRootRoute,
  path: '/tour/$lesson/$page',
});
storyRootRoute.addChildren([storyTourRoute]);

const meta = {
  component: TourPageView,
  args: { lesson, pageIndex: 0, catalog },
  render: (args) => <LessonPageStory {...args} />,
  parameters: {
    tanstack: {
      router: { route: storyTourRoute, params: { lesson: 'basics', page: '1' } },
    },
    // 既定はスマホ幅。2 カラムの story だけが広い viewport を指定する
    viewport: {
      defaultViewport: 'mobile2',
      options: {
        wide: { name: 'Wide desktop', styles: { width: '1280px', height: '800px' } },
        tabletLandscape: { name: 'Tablet landscape', styles: { width: '1024px', height: '768px' } },
        tabletPortrait: { name: 'Tablet portrait', styles: { width: '768px', height: '1024px' } },
      },
    },
  },
  beforeEach: () => {
    localStorage.removeItem(DISPLAY_SETTINGS_STORAGE_KEY);
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
  },
} satisfies Meta<typeof TourPageView>;

export default meta;
type Story = StoryObj<typeof meta>;

type StoryCanvas = Parameters<NonNullable<Story['play']>>[0]['canvas'];
type StoryUserEvent = Parameters<NonNullable<Story['play']>>[0]['userEvent'];

async function openDisplaySettings(
  canvas: StoryCanvas,
  userEvent: StoryUserEvent,
): Promise<HTMLElement> {
  await userEvent.click(canvas.getByRole('button', { name: '表示設定' }));
  return canvas.findByRole('dialog', { name: '表示設定' });
}

async function closeDisplaySettings(canvas: StoryCanvas, userEvent: StoryUserEvent): Promise<void> {
  const dialog = canvas.getByRole('dialog', { name: '表示設定' });
  await userEvent.click(within(dialog).getByRole('button', { name: '表示設定を閉じる' }));
  await waitFor(() =>
    expect(canvas.queryByRole('dialog', { name: '表示設定' })).not.toBeInTheDocument(),
  );
}

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
    await expect(canvas.getByRole('region', { name: /のコード例$/ })).toBeVisible();
  },
};

export const EnglishOnlyToggle: Story = {
  play: async ({ canvas, userEvent }) => {
    const dialog = await openDisplaySettings(canvas, userEvent);
    await userEvent.click(within(dialog).getByRole('button', { name: '英語のみ' }));
    await closeDisplaySettings(canvas, userEvent);

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
    const dialog = await openDisplaySettings(canvas, userEvent);
    await userEvent.click(within(dialog).getByRole('button', { name: '日本語のみ' }));
    await closeDisplaySettings(canvas, userEvent);

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

    const dialog = await openDisplaySettings(canvas, userEvent);
    await userEvent.click(within(dialog).getByRole('button', { name: '大' }));
    await expect(article).toHaveStyle({ fontSize: '20px' });

    await userEvent.click(within(dialog).getByRole('button', { name: '小' }));
    await expect(article).toHaveStyle({ fontSize: '16px' });

    await closeDisplaySettings(canvas, userEvent);
  },
};

export const Navigation: Story = {
  play: async ({ canvas }) => {
    const previous = canvas.getByRole('link', { name: /前へ/ });
    const next = canvas.getByRole('link', { name: /次へ/ });

    await expect(previous).toHaveAttribute('href', '/tour/welcome/2');
    await expect(previous).toHaveAttribute('aria-keyshortcuts', 'PageUp');
    await expect(previous).toHaveTextContent('Go をローカルで');
    await expect(next).toHaveAttribute('href', '/tour/basics/2');
    await expect(next).toHaveAttribute('aria-keyshortcuts', 'PageDown');
    await expect(next).toHaveTextContent('インポート');
  },
};

export const LastPage: Story = {
  args: { pageIndex: 2 },
  play: async ({ canvas }) => {
    const next = canvas.getByRole('link', { name: /次へ/ });
    await expect(next).toHaveAttribute('href', '/tour/flowcontrol/1');
    await expect(next).toHaveTextContent('for');
    // 確認問題の無いレッスン（quizAvailable の既定）では導線を出さない
    await expect(
      canvas.queryByRole('link', { name: '確認問題をはじめる' }),
    ).not.toBeInTheDocument();
  },
};

/** レッスンの最後のページでは、本文の後ろに確認問題への導線を出す。 */
export const LastPageWithQuiz: Story = {
  args: { pageIndex: 2, quizAvailable: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'このレッスンの確認問題' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: '確認問題をはじめる' })).toHaveAttribute(
      'href',
      '/quiz/basics',
    );
  },
};

/** 確認問題があっても、最後のページより前には導線を出さない。 */
export const QuizOnlyOnLastPage: Story = {
  args: { quizAvailable: true },
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByRole('link', { name: '確認問題をはじめる' }),
    ).not.toBeInTheDocument();
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
    const dialog = await openDisplaySettings(canvas, userEvent);
    await userEvent.click(within(dialog).getByRole('button', { name: '日本語のみ' }));
    await closeDisplaySettings(canvas, userEvent);

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

/**
 * 幅の広い画面では、左に本文、右にコードを置く。右カラムは Header の下に、
 * 前へ・次へはビューポートの下端に sticky で貼り付き、本文が長くてもスクロールせずに
 * ページ送りできる（ページ自体は普通にスクロールする）。
 */
export const WideLayout: Story = {
  globals: { viewport: { value: 'wide' } },
  play: async ({ canvas }) => {
    const articleBox = canvas.getByRole('article').getBoundingClientRect();
    const codeRegion = canvas.getByRole('region', { name: /のコード例$/ });
    const codeBox = codeRegion.getBoundingClientRect();
    const appHeader = canvas.getByRole('button', { name: '表示設定' }).closest('header');
    await expect(appHeader).not.toBeNull();
    const headerBox = appHeader!.getBoundingClientRect();

    // 左に本文、右にコードが並ぶ
    await expect(articleBox.right).toBeLessThanOrEqual(codeBox.left + 1);
    // 右カラムは Header の直下から前へ・次への上まで
    const nav = canvas.getByRole('navigation', { name: 'ページ移動' });
    const navBox = nav.getBoundingClientRect();
    await expect(codeBox.top).toBeGreaterThanOrEqual(headerBox.bottom);
    await expect(codeBox.bottom).toBeLessThanOrEqual(navBox.top);
    // 貼り付き（sticky）で、スクロールしても Header の下に残る
    await expect(getComputedStyle(codeRegion.parentElement!).position).toBe('sticky');

    // エディタは右カラムの中でスクロールする（カラムからはみ出さない）
    const editor = canvas.getByRole('textbox', { name: 'main.go のコード' });
    await expect(editor.getBoundingClientRect().bottom).toBeLessThanOrEqual(codeBox.bottom + 1);

    // 前へ・次へはスクロールしなくても見える（ビューポートの下端に貼り付く）
    await expect(getComputedStyle(nav).position).toBe('sticky');
    await expect(navBox.bottom).toBeLessThanOrEqual(window.innerHeight + 1);
  },
};

/** 1024px（タブレット横向き）から 2 カラムにする。 */
export const WideTabletLandscape: Story = {
  globals: { viewport: { value: 'tabletLandscape' } },
  play: async ({ canvas }) => {
    const articleBox = canvas.getByRole('article').getBoundingClientRect();
    const codeBox = canvas.getByRole('region', { name: /のコード例$/ }).getBoundingClientRect();
    await expect(articleBox.right).toBeLessThanOrEqual(codeBox.left + 1);
  },
};

/** コードの無いページは、幅の広い画面でも本文を中央 1 カラムで読む。 */
export const WideWithoutCode: Story = {
  args: { pageIndex: 1 },
  globals: { viewport: { value: 'wide' } },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('region', { name: /のコード例$/ })).not.toBeInTheDocument();

    const articleBox = canvas.getByRole('article').getBoundingClientRect();
    const center = (articleBox.left + articleBox.right) / 2;
    await expect(Math.abs(center - window.innerWidth / 2)).toBeLessThanOrEqual(1);
    await expect(articleBox.width).toBeLessThanOrEqual(576);
  },
};

/** スマホ幅では今までどおり、本文の下にコードを置く（横スクロールもしない）。 */
export const StackedOnMobile: Story = {
  globals: { viewport: { value: 'mobile2' } },
  play: async ({ canvas }) => {
    const articleBox = canvas.getByRole('article').getBoundingClientRect();
    const codeBox = canvas.getByRole('region', { name: /のコード例$/ }).getBoundingClientRect();
    const navBox = canvas.getByRole('navigation', { name: 'ページ移動' }).getBoundingClientRect();
    await expect(codeBox.top).toBeGreaterThanOrEqual(articleBox.bottom - 1);
    await expect(navBox.top).toBeGreaterThanOrEqual(codeBox.bottom - 1);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};

/** 768px（タブレット縦）でも 2 カラムにはせず、スマホと同じ縦積みにする。 */
export const StackedOnTabletPortrait: Story = {
  globals: { viewport: { value: 'tabletPortrait' } },
  play: async ({ canvas }) => {
    const articleBox = canvas.getByRole('article').getBoundingClientRect();
    const codeBox = canvas.getByRole('region', { name: /のコード例$/ }).getBoundingClientRect();
    await expect(codeBox.top).toBeGreaterThanOrEqual(articleBox.bottom - 1);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};

/**
 * PageUp / PageDown の遷移を確かめるための、実ルートと同じパスの細いルート。
 * 遷移のたびに loader が呼ばれるので、そこに page を記録する。
 */
const shortcutNavigationLog: string[] = [];

const shortcutRootRoute = createRootRoute();
const shortcutTourRoute = createRoute({
  getParentRoute: () => shortcutRootRoute,
  path: '/tour/$lesson/$page',
  loader: ({ params }) => {
    shortcutNavigationLog.push(`${params.lesson}/${params.page}`);
  },
});
shortcutRootRoute.addChildren([shortcutTourRoute]);

export const PageKeyNavigation: Story = {
  parameters: {
    tanstack: {
      router: {
        route: shortcutTourRoute,
        params: { lesson: 'basics', page: '1' },
      },
    },
  },
  play: async ({ userEvent }) => {
    shortcutNavigationLog.length = 0;

    await userEvent.keyboard('{PageDown}');
    await waitFor(() => expect(shortcutNavigationLog).toEqual(['basics/2']));

    await userEvent.keyboard('{PageUp}');
    await waitFor(() => expect(shortcutNavigationLog).toEqual(['basics/2', 'welcome/2']));
  },
};

/** エディタを編集中は、キーボードショートカットでページを移動しない。 */
export const EditorKeepsPageKeys: Story = {
  globals: { viewport: { value: 'wide' } },
  parameters: {
    tanstack: {
      router: {
        route: shortcutTourRoute,
        params: { lesson: 'basics', page: '1' },
      },
    },
  },
  play: async ({ canvas, userEvent }) => {
    shortcutNavigationLog.length = 0;

    await userEvent.click(canvas.getByRole('textbox', { name: 'main.go のコード' }));
    await userEvent.keyboard('{PageDown}');
    await userEvent.keyboard('{PageUp}');
    // 遷移していれば loader が呼ばれる。呼ばれないことを確かめる
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(shortcutNavigationLog).toEqual([]);
    await expect(canvas.getByText('ページ 1 / 3')).toBeVisible();
  },
};
