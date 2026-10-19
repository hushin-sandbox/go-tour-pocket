import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { createRootRoute, createRoute } from '@tanstack/react-router';
import { DisplaySettingsProvider } from '@/react-app/features/display-mode';
import { Header } from './Header';

const storyRootRoute = createRootRoute();
const storyTourRoute = createRoute({
  getParentRoute: () => storyRootRoute,
  path: '/tour/$lesson/$page',
});
storyRootRoute.addChildren([storyTourRoute]);

const meta = {
  component: Header,
  decorators: [
    (Story) => (
      <DisplaySettingsProvider>
        <Story />
      </DisplaySettingsProvider>
    ),
  ],
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Go Tour Pocket' })).toHaveAttribute('href', '/');
    await expect(canvas.getByRole('link', { name: 'このアプリについて' })).toHaveAttribute(
      'href',
      '/about',
    );
    // レッスン画面以外では表示設定を出さない
    await expect(canvas.queryByRole('button', { name: '表示設定' })).not.toBeInTheDocument();
    // ブラウザはオンラインなので、オフライン表示は出ない
    await expect(canvas.queryByText('オフライン')).not.toBeInTheDocument();
  },
};

/** レッスン画面では、右端のメニューから表示モードと文字サイズを切り替える。 */
export const LessonPageDisplaySettings: Story = {
  parameters: {
    tanstack: {
      router: { route: storyTourRoute, params: { lesson: 'basics', page: '1' } },
    },
  },
  play: async ({ canvas }) => {
    const dialog = await (async () => {
      await userEvent.click(canvas.getByRole('button', { name: '表示設定' }));
      return canvas.findByRole('dialog', { name: '表示設定' });
    })();

    await userEvent.click(within(dialog).getByRole('button', { name: '英語のみ' }));
    await expect(within(dialog).getByRole('button', { name: '英語のみ' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: '大' }));
    await expect(within(dialog).getByRole('button', { name: '大' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: '表示設定を閉じる' }));
    await waitFor(() =>
      expect(canvas.queryByRole('dialog', { name: '表示設定' })).not.toBeInTheDocument(),
    );
  },
};
