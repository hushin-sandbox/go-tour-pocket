import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect } from 'storybook/test';
import { OfflineIndicator } from './OfflineIndicator';

const meta = {
  component: OfflineIndicator,
  args: { online: false },
} satisfies Meta<typeof OfflineIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Offline: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('オフライン');
  },
};

export const Online: Story = {
  args: { online: true },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('status')).not.toBeInTheDocument();
  },
};
