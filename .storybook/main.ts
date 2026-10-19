import type { StorybookConfig } from '@storybook/tanstack-react';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
  ],
  framework: '@storybook/tanstack-react',
  // ルートの vite.config.ts の tailwindcss() だけでは vitest 時に
  // 反映されないため、ここでも明示的に追加する。
  async viteFinal(viteConfig) {
    viteConfig.plugins ??= [];
    viteConfig.plugins.push(tailwindcss());
    return viteConfig;
  },
};
export default config;
