/**
 * リポジトリ内のパス。
 *
 * `vite.config.ts` に取り込まれると `import.meta.dirname` が Vite に置き換わるため、
 * ここではルートを引数で受け取る（プラグインは `config.root` を渡す）。
 */
import path from 'node:path';

/** ビルドで生成する JSON。Vite の outDir（dist）のルートに置く。 */
export const LICENSES_JSON_FILE_NAME = 'licenses.json';

/** 取得したライセンス本文のキャッシュ（`.gitignore` の `.cache/` 以下）。 */
export function licensesCacheDir(rootDir: string): string {
  return path.join(rootDir, '.cache', 'licenses');
}

/** golang/website の LICENSE を保存するファイル。コミットごとに分ける。 */
export function websiteLicenseCacheFile(commit: string, rootDir: string): string {
  return path.join(licensesCacheDir(rootDir), `website-${commit.slice(0, 12)}-LICENSE`);
}

/** `scripts/content` が sparse-checkout した golang/website の LICENSE（あれば）。 */
export function websiteCheckoutLicenseFile(rootDir: string): string {
  return path.join(rootDir, '.cache', 'website', 'LICENSE');
}

/** `wasm/` モジュールのディレクトリ。`go list` はここで実行する。 */
export function wasmDir(rootDir: string): string {
  return path.join(rootDir, 'wasm');
}
