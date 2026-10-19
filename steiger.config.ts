import { defineConfig } from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // 表示モードは現状ページ画面だけで使うが、design.md で features/display-mode として
    // 独立させる方針のため、参照数だけを理由に pages/tour-page へ畳まない。
    files: ['./src/react-app/features/display-mode/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
]);
