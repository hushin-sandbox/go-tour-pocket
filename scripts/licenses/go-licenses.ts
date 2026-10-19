/**
 * `wasm/` のビルドで実際に使われる Go モジュールと、Go 本体のライセンスを集める。
 *
 * モジュールは `GOOS=js GOARCH=wasm go list -deps` の結果から取り出す
 * （標準ライブラリとメインモジュールは除く）。Go 本体は `go env GOROOT` の
 * LICENSE と PATENTS、バージョンは `go env GOVERSION` から読む。
 */
import fs from 'node:fs';
import path from 'node:path';
import type { LicenseEntry } from '../../src/shared/licenses.ts';
import { extractCopyrightHolder, identifyLicense } from './license-text.ts';

/** go コマンドを実行して標準出力を返す関数。テストでは差し替える。 */
export type GoCommandRunner = (args: string[], cwd: string) => string;

export type GoModule = {
  path: string;
  version: string;
  dir: string;
};

/** `go list -deps` に渡すテンプレート。メインモジュールと標準ライブラリは空行になる。 */
export const GO_MODULE_LIST_FORMAT = [
  '{{with .Module}}',
  '{{if not .Main}}{{.Path}}\t{{.Version}}\t{{.Dir}}{{end}}',
  '{{end}}',
].join('');

export const GO_LIST_ARGS = ['list', '-deps', '-f', GO_MODULE_LIST_FORMAT, '.'];

export function parseGoModuleList(output: string): GoModule[] {
  // `-deps` はパッケージ単位で出力されるので、モジュール単位にまとめる。
  const modules = new Map<string, GoModule>();
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const [modulePath, version, dir] = trimmed.split('\t');
    if (modulePath === undefined || version === undefined || dir === undefined) continue;
    if (!modules.has(modulePath)) modules.set(modulePath, { path: modulePath, version, dir });
  }
  return [...modules.values()].toSorted((a, b) => a.path.localeCompare(b.path));
}

export type GoToolchainLicenses = {
  version: string;
  license: string;
  patents: string;
};

const LICENSE_FILE_PATTERN = /^(licen[cs]e|copying)([.-].*)?$/i;
const NOTICE_FILE_PATTERN = /^notice([.-].*)?$/i;

function readLicenseFiles(dir: string): {
  texts: { name: string; text: string }[];
  notices: { name: string; text: string }[];
} {
  const texts: { name: string; text: string }[] = [];
  const notices: { name: string; text: string }[] = [];
  for (const file of fs.readdirSync(dir).toSorted()) {
    const isLicense = LICENSE_FILE_PATTERN.test(file);
    const isNotice = NOTICE_FILE_PATTERN.test(file);
    if (!isLicense && !isNotice) continue;
    const text = fs.readFileSync(path.join(dir, file), 'utf8').trim();
    if (text === '') continue;
    (isLicense ? texts : notices).push({ name: file, text });
  }
  return { texts, notices };
}

/** Go 本体（GOROOT）の LICENSE と PATENTS、バージョンを読む。 */
export function readGoToolchainLicenses(run: GoCommandRunner): GoToolchainLicenses {
  const goroot = run(['env', 'GOROOT'], process.cwd()).trim();
  const version = run(['env', 'GOVERSION'], process.cwd()).trim();
  const license = fs.readFileSync(path.join(goroot, 'LICENSE'), 'utf8').trim();
  const patents = fs.readFileSync(path.join(goroot, 'PATENTS'), 'utf8').trim();
  return { version, license, patents };
}

/** `go list -deps` の結果から、第三者モジュールのライセンスエントリを作る。 */
export function collectGoModuleEntries(run: GoCommandRunner, wasmDir: string): LicenseEntry[] {
  const modules = parseGoModuleList(run(GO_LIST_ARGS, wasmDir));
  return modules.map((module) => {
    const { texts, notices } = readLicenseFiles(module.dir);
    const text = texts.map((file) => file.text).join('\n\n');
    if (text === '') {
      throw new Error(
        `Go モジュール ${module.path}@${module.version} のライセンス全文が見つかりません: ${module.dir}`,
      );
    }
    const license = identifyLicense(text);
    if (license === null) {
      throw new Error(
        `Go モジュール ${module.path}@${module.version} のライセンスを特定できません: ${module.dir}`,
      );
    }
    return {
      id: `go:${module.path}`,
      name: module.path,
      version: module.version,
      license,
      author: extractCopyrightHolder(text),
      url: `https://pkg.go.dev/${module.path}@${module.version}`,
      text,
      note: null,
      extras: notices.map((notice) => ({ label: notice.name, text: notice.text })),
    } satisfies LicenseEntry;
  });
}

/** Go 本体（ランタイム・標準ライブラリ・wasm_exec.js）のエントリを作る。 */
export function goRuntimeEntry(toolchain: GoToolchainLicenses): LicenseEntry {
  const license = identifyLicense(toolchain.license);
  if (license === null) {
    throw new Error('Go 本体のライセンスを特定できません（GOROOT/LICENSE）');
  }
  return {
    id: 'go:runtime',
    name: 'Go のランタイムと標準ライブラリ、wasm_exec.js',
    version: toolchain.version,
    license,
    author: extractCopyrightHolder(toolchain.license),
    url: 'https://go.dev/',
    text: toolchain.license,
    note:
      'yaegi.wasm には Go のランタイムと標準ライブラリの一部、' +
      'public/wasm/wasm_exec.js には Go の wasm 実行環境が含まれます。',
    extras: [{ label: 'PATENTS', text: toolchain.patents }],
  };
}
