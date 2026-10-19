import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { AboutPage } from './AboutPage';

const meta = {
  component: AboutPage,
} satisfies Meta<typeof AboutPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Go Tour Pocket について' }),
    ).toBeVisible();
    await expect(
      canvas.getByRole('heading', { name: '実行結果についての既知の差異' }),
    ).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'iPhone / iPad（Safari）' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Android（Chrome）' })).toBeVisible();

    await expect(canvas.getByRole('link', { name: 'ライセンス' })).toHaveAttribute(
      'href',
      '/licenses',
    );
    await expect(canvas.getByRole('link', { name: '実行エンジンの診断' })).toHaveAttribute(
      'href',
      '/spike',
    );
    await expect(canvas.getByRole('link', { name: /A Tour of Go の原文/ })).toHaveAttribute(
      'href',
      'https://go.dev/tour/',
    );
  },
};
