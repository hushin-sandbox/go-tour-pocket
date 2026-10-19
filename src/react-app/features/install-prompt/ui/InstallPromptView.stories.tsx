import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect, fn } from 'storybook/test';
import type { InstallPromptContext } from '../model/install-prompt';
import { InstallPromptView } from './InstallPromptView';

const androidChrome: InstallPromptContext = {
  hasInstallEvent: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  maxTouchPoints: 5,
  standalone: false,
  dismissed: false,
};

const iphoneSafari: InstallPromptContext = {
  hasInstallEvent: false,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  maxTouchPoints: 5,
  standalone: false,
  dismissed: false,
};

const meta = {
  component: InstallPromptView,
  args: {
    context: androidChrome,
    onInstall: fn(),
    onDismiss: fn(),
  },
} satisfies Meta<typeof InstallPromptView>;

export default meta;
type Story = StoryObj<typeof meta>;

const installRegion = { name: 'インストールの案内' } as const;

export const Chromium: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole('region', installRegion)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'インストール' }));
    await expect(args.onInstall).toHaveBeenCalledOnce();
  },
};

export const Ios: Story = {
  args: { context: iphoneSafari },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByRole('region', installRegion)).toBeVisible();
    await expect(canvas.getByText('「ホーム画面に追加」を選ぶ')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: '閉じる' }));
    await expect(args.onDismiss).toHaveBeenCalledOnce();
  },
};

export const NoInstallEvent: Story = {
  args: { context: { ...androidChrome, hasInstallEvent: false } },
  play: async ({ canvas }) => {
    // beforeinstallprompt が来ないブラウザでは導線を出さない
    await expect(canvas.queryByRole('region', installRegion)).not.toBeInTheDocument();
  },
};

export const Standalone: Story = {
  args: { context: { ...androidChrome, standalone: true } },
  play: async ({ canvas }) => {
    // すでにホーム画面から起動しているなら出さない
    await expect(canvas.queryByRole('region', installRegion)).not.toBeInTheDocument();
  },
};

export const IosDismissed: Story = {
  args: { context: { ...iphoneSafari, dismissed: true } },
  play: async ({ canvas }) => {
    // 一度閉じた手順カードは出さない
    await expect(canvas.queryByRole('region', installRegion)).not.toBeInTheDocument();
  },
};
