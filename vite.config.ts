import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';
import { licensesPlugin } from './scripts/licenses/plugin.ts';

// Storybook / vitest はこの設定ファイルを取り込んで自身の preview ビルドにも使う。
// VitePWA を有効にするとテスト実行時にも Service Worker の生成が走って壊れるため、
// vitest / storybook からの実行時は含めない。
const isStorybookOrVitest = Boolean(process.env.VITEST || process.env.STORYBOOK);

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    // '@tanstack/router-plugin' は '@vitejs/plugin-react' より前に置く
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/react-app/routes',
      // route と colocation した *.stories.tsx / *.mock.ts をルート扱いしない
      routeFileIgnorePattern: '\\.(stories|mock)\\.',
      generatedRouteTree: './src/react-app/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    ...(isStorybookOrVitest
      ? []
      : [
          VitePWA({
            // 新しい Service Worker は install 後すぐ skipWaiting + clientsClaim で
            // 制御を取り、ページ側の registerSW（features/app-update の useRegisterSW）が
            // activated を検知して自動でリロードする。更新 UI を持たない旧版のページが
            // waiting のまま残らないようにするため prompt は使わない。
            // 登録も useRegisterSW に任せるので injectRegister は切る
            registerType: 'autoUpdate',
            injectRegister: null,
            manifest: {
              name: 'Go Tour Pocket',
              short_name: 'Go Tour',
              description: 'A Tour of Go を英日対訳・オフラインで学べるスマホ向け PWA',
              lang: 'ja',
              start_url: '/',
              scope: '/',
              display: 'standalone',
              background_color: '#f8fafc',
              theme_color: '#0f172a',
              icons: [
                {
                  src: '/icons/icon-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                },
                {
                  src: '/icons/icon-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                },
                {
                  src: '/icons/maskable-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              // wasm（約 13MB）を含めるため上限を引き上げる
              globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff2,wasm}'],
              maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
              navigateFallback: '/index.html',
              // autoUpdate でも明示しておく（generateSW のデフォルトに依存しない）
              skipWaiting: true,
              clientsClaim: true,
              cleanupOutdatedCaches: true,
            },
          }),
        ]),
    // ライセンスの収集は VitePWA の後ろに置く（生成された sw.js を読むため）。
    licensesPlugin(),
  ],
});
