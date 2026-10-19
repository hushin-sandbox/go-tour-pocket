import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { AppUpdateToast } from './AppUpdateToast';

const meta = {
  component: AppUpdateToast,
  args: {
    open: true,
    title: 'オフラインでも使えます',
    description: 'レッスンと実行エンジンを保存しました。通信がなくても開けます。',
  },
} satisfies Meta<typeof AppUpdateToast>;

export default meta;
type Story = StoryObj<typeof meta>;

// トーストはフェードインするので toBeVisible は早すぎる。表示条件は role=status の
// テキストで確認する。
export const OfflineReady: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('オフラインでも使えます');
    // 控えめな通知なのでボタンを出さない（数秒で自動的に消える）
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
  },
};

export const Hidden: Story = {
  args: { open: false },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
  },
};
