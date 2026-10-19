import { defineConfig } from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // インストール導線はホームに置く予定だが、ホームは別ブランチで実装中。
    // 参照が付くまでの間だけ「参照の無いスライス」判定を切る。
    files: ['./src/react-app/features/install-prompt/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
]);
