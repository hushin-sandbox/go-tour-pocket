import { defineConfig } from 'steiger';
import fsd from '@feature-sliced/steiger-plugin';

export default defineConfig([
  ...fsd.configs.recommended,
  {
    // CodeRunner ウィジェットはレッスン画面（別ブランチで実装中）から参照される。
    // このブランチ単体では参照元がないため、マージまでの間だけ無効化する。
    files: ['./src/react-app/widgets/code-runner/**'],
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
]);
