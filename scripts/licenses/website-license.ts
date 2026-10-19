/**
 * golang/website の LICENSE（BSD-3-Clause）を用意する。
 *
 * 1. `.cache/website/LICENSE`（`scripts/content` の sparse-checkout に含まれていれば）
 * 2. `.cache/licenses/` のキャッシュ
 * 3. GitHub の固定コミットから取得してキャッシュ
 */
import fs from 'node:fs';
import path from 'node:path';
import { SOURCE_COMMIT, SOURCE_REPOSITORY } from '../content/source.ts';
import { websiteCheckoutLicenseFile, websiteLicenseCacheFile } from './paths.ts';

export function websiteLicenseUrl(
  commit: string = SOURCE_COMMIT,
  repository: string = SOURCE_REPOSITORY,
): string {
  return `https://raw.githubusercontent.com/${repository}/${commit}/LICENSE`;
}

export type WebsiteLicenseDeps = {
  readFile: (filePath: string) => string | null;
  writeFile: (filePath: string, text: string) => void;
  fetchText: (url: string) => Promise<string>;
};

export const websiteLicenseDeps: WebsiteLicenseDeps = {
  readFile: (filePath) =>
    fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').trim() : null,
  writeFile: (filePath, text) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${text}\n`);
  },
  fetchText: async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      throw new Error(`GET ${url} が ${response.status} を返しました`);
    }
    return (await response.text()).trim();
  },
};

export async function loadWebsiteLicense(
  rootDir: string,
  deps: WebsiteLicenseDeps = websiteLicenseDeps,
  commit: string = SOURCE_COMMIT,
): Promise<string> {
  const candidates = [
    websiteCheckoutLicenseFile(rootDir),
    websiteLicenseCacheFile(commit, rootDir),
  ];
  for (const file of candidates) {
    const cached = deps.readFile(file);
    if (cached !== null && cached !== '') return cached;
  }

  const url = websiteLicenseUrl(commit);
  let text: string;
  try {
    text = await deps.fetchText(url);
  } catch (error) {
    throw new Error(
      `golang/website の LICENSE を取得できませんでした（${url}）: ` +
        `${error instanceof Error ? error.message : String(error)}。` +
        'ネットワークにつながる環境で一度ビルドするか、.cache/ にキャッシュを置いてください',
      { cause: error },
    );
  }
  if (text === '') throw new Error(`golang/website の LICENSE が空でした（${url}）`);
  deps.writeFile(websiteLicenseCacheFile(commit, rootDir), text);
  return text;
}
