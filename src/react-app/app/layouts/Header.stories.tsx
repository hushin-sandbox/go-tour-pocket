import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { Header } from './Header';

const meta = {
  component: Header,
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
    // ブラウザはオンラインなので、オフライン表示は出ない
    await expect(canvas.queryByText('オフライン')).not.toBeInTheDocument();
  },
};
