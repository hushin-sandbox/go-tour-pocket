import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect, fn } from 'storybook/test';
import { AppUpdateToast } from './AppUpdateToast';

const meta = {
  component: AppUpdateToast,
  args: {
    open: true,
    title: '新しいバージョンがあります',
    description: '更新すると、最新のレッスンと修正が反映されます。',
    actionLabel: '更新',
    onAction: fn(),
    dismissLabel: '後で',
    onDismiss: fn(),
  },
} satisfies Meta<typeof AppUpdateToast>;

export default meta;
type Story = StoryObj<typeof meta>;

// トーストはフェードインするので toBeVisible は早すぎる。表示条件は role=status の
// テキストと、出ているボタンで確認する。
export const Update: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('新しいバージョンがあります');
    await userEvent.click(canvas.getByRole('button', { name: '更新' }));
    await expect(args.onAction).toHaveBeenCalledOnce();
  },
};

export const Dismiss: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '後で' }));
    await expect(args.onDismiss).toHaveBeenCalledOnce();
  },
};

export const OfflineReady: Story = {
  args: {
    title: 'オフラインでも使えます',
    description: 'レッスンと実行エンジンを保存しました。通信がなくても開けます。',
    actionLabel: undefined,
    onAction: undefined,
    dismissLabel: undefined,
    onDismiss: undefined,
  },
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
