/**
 * Vite（Rolldown）のビルドに実際に入った npm パッケージのライセンスを集める。
 *
 * 対象は node_modules 配下のモジュール id だけ。`package.json` の license を優先し、
 * `SEE LICENSE IN ...` のような間接参照しかないときは LICENSE 本文から推定する。
 * ライセンス名も全文も特定できないパッケージがあれば例外を投げ、ビルドを失敗させる。
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { LicenseEntry } from '../../src/shared/licenses.ts';
import {
  extractCopyrightHolder,
  identifyLicenses,
  normalizeAuthor,
  normalizeLicenseField,
  normalizeRepositoryUrl,
} from './license-text.ts';
import { standardLicenseText } from './license-texts.ts';

/** テストで fs を差し替えられるようにするための最小の依存。 */
export type LicenseFileSystem = {
  readFile: (filePath: string) => string;
  readdir: (dir: string) => string[];
  exists: (filePath: string) => boolean;
};

const nodeFileSystem: LicenseFileSystem = {
  readFile: (filePath) => fs.readFileSync(filePath, 'utf8'),
  readdir: (dir) => fs.readdirSync(dir),
  exists: (filePath) => fs.existsSync(filePath),
};

const NODE_MODULES_SEGMENT = `${path.sep}node_modules${path.sep}`;
const LICENSE_FILE_PATTERN = /^(licen[cs]e|copying)([.-].*)?$/i;
const NOTICE_FILE_PATTERN = /^notice([.-].*)?$/i;

/**
 * モジュール id からパッケージのルートディレクトリを取り出す。
 *
 * pnpm は `<root>/node_modules/.pnpm/<name>@<version>/node_modules/<name>/...`
 * に実体を置くので、最後の `node_modules/` の直後をパッケージ名として読む。
 */
export function packageDirFromModuleId(moduleId: string): string | null {
  const withoutQuery = moduleId.replace(/[?#].*$/, '');
  const index = withoutQuery.lastIndexOf(NODE_MODULES_SEGMENT);
  if (index === -1) return null;
  const prefix = withoutQuery.slice(0, index + NODE_MODULES_SEGMENT.length);
  const segments = withoutQuery.slice(prefix.length).split(path.sep);
  const first = segments[0];
  if (first === undefined || first === '') return null;
  const name = first.startsWith('@') ? `${first}/${segments[1] ?? ''}` : first;
  if (name.endsWith('/')) return null;
  return path.join(prefix, name);
}

/** モジュール id の一覧から、重複を除いたパッケージディレクトリの一覧を作る。 */
export function packageDirsFromModuleIds(moduleIds: Iterable<string>): string[] {
  const dirs = new Set<string>();
  for (const moduleId of moduleIds) {
    const dir = packageDirFromModuleId(moduleId);
    if (dir !== null) dirs.add(dir);
  }
  return [...dirs].toSorted();
}

const packageJsonSchema = z.looseObject({
  name: z.unknown().optional(),
  version: z.unknown().optional(),
  license: z.unknown().optional(),
  licenses: z.unknown().optional(),
  author: z.unknown().optional(),
  homepage: z.unknown().optional(),
  repository: z.unknown().optional(),
});

type PackageJson = z.infer<typeof packageJsonSchema>;

function readLicenseFiles(
  dir: string,
  fileSystem: LicenseFileSystem,
): { licenseTexts: { name: string; text: string }[]; notices: { name: string; text: string }[] } {
  const licenseTexts: { name: string; text: string }[] = [];
  const notices: { name: string; text: string }[] = [];
  for (const file of fileSystem.readdir(dir).toSorted()) {
    const isLicense = LICENSE_FILE_PATTERN.test(file);
    const isNotice = NOTICE_FILE_PATTERN.test(file);
    if (!isLicense && !isNotice) continue;
    const text = fileSystem.readFile(path.join(dir, file)).trim();
    if (text === '') continue;
    (isLicense ? licenseTexts : notices).push({ name: file, text });
  }
  return { licenseTexts, notices };
}

function resolveUrl(packageJson: PackageJson, name: string): string | null {
  if (typeof packageJson.homepage === 'string' && packageJson.homepage.trim() !== '') {
    return packageJson.homepage.trim();
  }
  const repository = packageJson.repository;
  const repositoryUrl =
    typeof repository === 'object' && repository !== null && 'url' in repository
      ? repository.url
      : repository;
  return normalizeRepositoryUrl(repositoryUrl) ?? `https://www.npmjs.com/package/${name}`;
}

/** パッケージ 1 つ分のライセンスエントリを作る。 */
export function collectNpmEntry(dir: string, fileSystem = nodeFileSystem): LicenseEntry {
  const packageJsonPath = path.join(dir, 'package.json');
  if (!fileSystem.exists(packageJsonPath)) {
    throw new Error(`npm パッケージの package.json が見つかりません: ${packageJsonPath}`);
  }
  const packageJson = packageJsonSchema.parse(JSON.parse(fileSystem.readFile(packageJsonPath)));
  const name = typeof packageJson.name === 'string' ? packageJson.name : path.basename(dir);
  const version = typeof packageJson.version === 'string' ? packageJson.version : null;
  const { licenseTexts, notices } = readLicenseFiles(dir, fileSystem);
  const text = licenseTexts.map((file) => file.text).join('\n\n');

  const license =
    normalizeLicenseField(packageJson.license) ??
    normalizeLicenseField(packageJson.licenses) ??
    identifyLicenses(licenseTexts.map((file) => file.text));
  if (license === null) {
    throw new Error(
      `npm パッケージ ${name}@${version ?? '?'} のライセンスを特定できません。` +
        'package.json の license か LICENSE ファイルを確認してください',
    );
  }
  const author =
    normalizeAuthor(packageJson.author) ??
    extractCopyrightHolder(licenseTexts.map((file) => file.text).join('\n'));

  // LICENSE を同梱していないパッケージ（例: is-node-process）は、
  // package.json が宣言するライセンスの標準的な全文を注記付きで掲載する。
  if (text === '') {
    const fallback = standardLicenseText(license, author ?? `${name} authors`);
    if (fallback === null) {
      throw new Error(
        `npm パッケージ ${name}@${version ?? '?'} のライセンス全文が見つかりません（license: ${license}）`,
      );
    }
    return {
      id: `npm:${name}`,
      name,
      version,
      license,
      author,
      url: resolveUrl(packageJson, name),
      text: fallback,
      note:
        '配布物に LICENSE ファイルが含まれていないため、package.json が宣言するライセンスの' +
        '標準的な全文を掲載しています。',
      extras: notices.map((notice) => ({ label: notice.name, text: notice.text })),
    };
  }

  return {
    id: `npm:${name}`,
    name,
    version,
    license,
    author,
    url: resolveUrl(packageJson, name),
    text,
    note: null,
    extras: notices.map((notice) => ({ label: notice.name, text: notice.text })),
  };
}

/** バンドルされた npm パッケージのエントリを、名前順でまとめて作る。 */
export function collectNpmEntries(
  packageDirs: string[],
  fileSystem = nodeFileSystem,
): LicenseEntry[] {
  return packageDirs
    .map((dir) => collectNpmEntry(dir, fileSystem))
    .toSorted((a, b) => {
      return a.name.localeCompare(b.name);
    });
}
