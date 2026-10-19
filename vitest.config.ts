import { defaultExclude, defineConfig } from 'vitest/config';
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = import.meta.dirname;

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          // 外部スキル（skills-lock.json から復元）の assets は「貼り付け用の実ファイル」で、
          // このリポジトリでは解決できない import を含むことがあるためテスト対象から外す。
          // .wt は git worktree の置き場（別ブランチの作業ツリー）。
          // scripts/ は Node 環境の project で別途動かす。
          exclude: [...defaultExclude, '**/skills/*/assets/**', '**/.wt/**', 'scripts/**'],
        },
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
        },
      },
      {
        // コンテンツ生成・ライセンス収集のスクリプトは node:fs を使うので Node で動かす。
        extends: false,
        test: {
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.test.ts'],
        },
      },
    ],
  },
});
