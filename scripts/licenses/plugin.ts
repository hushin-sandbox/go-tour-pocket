/**
 * `/licenses` 用のライセンスデータをビルド時に集める Vite プラグイン。
 *
 * - npm: Rolldown のビルドグラフに入ったモジュールだけを対象にする
 * - Go: `go list -deps`（GOOS=js GOARCH=wasm）と GOROOT の LICENSE / PATENTS
 * - コンテンツ: A Tour of Go 本文と日本語訳の CC BY 4.0 表記
 * - Service Worker: vite-plugin-pwa が生成した sw.js / workbox-*.js のマーカー
 *
 * データは `virtual:licenses` の JS チャンクに埋め込むので、Service Worker の
 * precache にそのまま乗る。`dist/licenses.json` も点検用に書き出す。
 * ライセンスが特定できない依存があればビルドを失敗させる。
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import type { LicenseEntry, LicensesData } from '../../src/shared/licenses.ts';
import { serviceWorkerSection } from '../../src/shared/licenses.ts';
import { assembleLicensesData, serializeLicensesData, validateLicensesData } from './collect.ts';
import { collectContentEntries } from './content-licenses.ts';
import {
  collectGoModuleEntries,
  goRuntimeEntry,
  readGoToolchainLicenses,
  type GoCommandRunner,
} from './go-licenses.ts';
import { collectNpmEntries, packageDirsFromModuleIds } from './npm-licenses.ts';
import { LICENSES_JSON_FILE_NAME, wasmDir } from './paths.ts';
import { collectServiceWorkerEntries, type WorkboxPackageResolver } from './sw-licenses.ts';
import { loadWebsiteLicense } from './website-license.ts';

export const VIRTUAL_MODULE_ID = 'virtual:licenses';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

/** 生成物に残すマーカー。ビルド時に JSON へ置き換える。 */
export const LICENSES_DATA_MARKER = 'GO_TOUR_POCKET_LICENSES_DATA';
export const LICENSES_SW_MARKER = 'GO_TOUR_POCKET_LICENSES_SERVICE_WORKER';

/**
 * マーカーを JS の文字列リテラルの中身として置き換える。
 *
 * モジュール側は `JSON.parse("<マーカー>")` なので、JSON を文字列として
 * エスケープしたものを差し込めばそのまま JSON.parse できる。
 */
export function replaceMarker(code: string, marker: string, value: unknown): string {
  const escaped = JSON.stringify(JSON.stringify(value)).slice(1, -1);
  return code.replaceAll(marker, escaped);
}

/** precache の revision を、パッチ後の内容の md5 に直す。 */
export function patchPrecacheRevision(swCode: string, url: string, revision: string): string {
  const escapedUrl = url.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\{url:"${escapedUrl}",revision:)(?:"[^"]*"|null)(\\})`);
  return swCode.replace(pattern, `$1"${revision}"$2`);
}

/** Service Worker の生成物を探すファイル名。 */
export function isServiceWorkerFile(fileName: string): boolean {
  return fileName === 'sw.js' || /^workbox-.+\.js$/.test(fileName);
}

export function contentHash(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

function jsonToJsLiteral(value: unknown): string {
  return JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

function isClientEnvironment(context: { environment?: { name?: string } }): boolean {
  return context.environment?.name === 'client';
}

/** `wasm/` のビルドと同じ条件で go コマンドを実行する。 */
const runGo: GoCommandRunner = (args, cwd) =>
  execFileSync('go', args, {
    cwd,
    env: { ...process.env, GOOS: 'js', GOARCH: 'wasm' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

function listFiles(dir: string, extension: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(fullPath, extension));
    else if (entry.name.endsWith(extension)) files.push(fullPath);
  }
  return files;
}

/** 生成済みのチャンクに Service Worker 分を埋め込み、precache の revision を直す。 */
function patchServiceWorkerLicenses(outDir: string, entries: LicenseEntry[]): void {
  const patchedFiles: string[] = [];
  for (const file of listFiles(outDir, '.js')) {
    const code = fs.readFileSync(file, 'utf8');
    if (!code.includes(LICENSES_SW_MARKER)) continue;
    const patched = replaceMarker(code, LICENSES_SW_MARKER, entries);
    fs.writeFileSync(file, patched);
    patchedFiles.push(path.relative(outDir, file).split(path.sep).join('/'));
  }

  if (patchedFiles.length === 0) return;

  // assets/ のファイルは revision:null（ファイル名がハッシュ）なので、
  // ここで内容を書き換えた分だけ revision を更新して再取得させる。
  const swPath = path.join(outDir, 'sw.js');
  if (fs.existsSync(swPath)) {
    let swCode = fs.readFileSync(swPath, 'utf8');
    for (const relative of patchedFiles) {
      const content = fs.readFileSync(path.join(outDir, relative), 'utf8');
      const patched = patchPrecacheRevision(swCode, relative, contentHash(content));
      if (patched === swCode) {
        throw new Error(
          `Service Worker の precache に ${relative} が見つからず、revision を更新できません`,
        );
      }
      swCode = patched;
    }
    fs.writeFileSync(swPath, swCode);
  }
}

export function licensesPlugin(): Plugin {
  let config: ResolvedConfig;
  let mainSections: Promise<LicensesData> | null = null;
  let renderedLicensesChunk = false;
  let devData: LicensesData | null = null;
  let devServiceWorker: LicenseEntry[] | null = null;

  const resolveWorkboxPackage: WorkboxPackageResolver = (packageName) => {
    try {
      const requireFromRoot = createRequire(path.join(config.root, 'package.json'));
      const pwaPackageJson = requireFromRoot.resolve('vite-plugin-pwa/package.json');
      const resolved = createRequire(pwaPackageJson).resolve(`${packageName}/package.json`);
      return path.dirname(resolved);
    } catch {
      return null;
    }
  };

  async function computeMainSections(moduleIds: string[]): Promise<LicensesData> {
    const toolchain = readGoToolchainLicenses(runGo);
    const websiteLicense = await loadWebsiteLicense(config.root);
    return assembleLicensesData({
      content: collectContentEntries({ websiteLicense, goLicense: toolchain.license }),
      go: [goRuntimeEntry(toolchain), ...collectGoModuleEntries(runGo, wasmDir(config.root))],
      npm: collectNpmEntries(packageDirsFromModuleIds(moduleIds)),
    });
  }

  /**
   * バンドルに含まれる npm パッケージの手がかり。
   *
   * CSS から参照されるフォント（@fontsource など）は Rolldown のモジュールにならないので、
   * 出力されたアセットの元ファイルからもパッケージを拾う。
   */
  function collectBundledPaths(
    moduleIds: Iterable<string>,
    bundle: Record<string, { type: string; originalFileNames?: string[] }>,
  ): string[] {
    const paths = new Set<string>();
    for (const id of moduleIds) paths.add(id);
    for (const output of Object.values(bundle)) {
      if (output.type !== 'asset') continue;
      for (const original of output.originalFileNames ?? []) {
        paths.add(path.resolve(config.root, original));
      }
    }
    return [...paths];
  }

  /** 直前のビルドの `licenses.json`。開発サーバーではこれをそのまま使う。 */
  function readBuiltData(): { data: LicensesData; serviceWorker: LicenseEntry[] } | null {
    const file = path.resolve(config.root, config.build.outDir, LICENSES_JSON_FILE_NAME);
    if (!fs.existsSync(file)) return null;
    const data = validateLicensesData(JSON.parse(fs.readFileSync(file, 'utf8')));
    const serviceWorker =
      data.sections.find((section) => section.id === 'service-worker')?.entries ?? [];
    // ページ側が Service Worker 分を足すので、ここでは外しておく。
    return {
      data: { sections: data.sections.filter((section) => section.id !== 'service-worker') },
      serviceWorker,
    };
  }

  async function getDevData(): Promise<{ data: LicensesData; serviceWorker: LicenseEntry[] }> {
    if (devData !== null && devServiceWorker !== null) {
      return { data: devData, serviceWorker: devServiceWorker };
    }
    const built = readBuiltData();
    if (built !== null) {
      devData = built.data;
      devServiceWorker = built.serviceWorker;
      return built;
    }
    config.logger.info(
      'licenses: 開発サーバーでは npm と Workbox の一覧は生成されません' +
        '（一度 `pnpm build` すると dist/licenses.json から読み込みます）',
    );
    const toolchain = readGoToolchainLicenses(runGo);
    const websiteLicense = await loadWebsiteLicense(config.root);
    devData = assembleLicensesData({
      content: collectContentEntries({ websiteLicense, goLicense: toolchain.license }),
      go: [goRuntimeEntry(toolchain), ...collectGoModuleEntries(runGo, wasmDir(config.root))],
      npm: [],
    });
    devServiceWorker = [];
    return { data: devData, serviceWorker: devServiceWorker };
  }

  async function loadVirtualModule(): Promise<string> {
    const serveLike =
      config.command === 'serve' ||
      process.env.VITEST !== undefined ||
      process.env.STORYBOOK !== undefined;
    if (serveLike) {
      const { data, serviceWorker } = await getDevData();
      return [
        `export const licensesData = ${jsonToJsLiteral(data)};`,
        `export const serviceWorkerLicenses = ${jsonToJsLiteral(serviceWorker)};`,
      ].join('\n');
    }
    return [
      `export const licensesData = JSON.parse("${LICENSES_DATA_MARKER}");`,
      `export const serviceWorkerLicenses = JSON.parse("${LICENSES_SW_MARKER}");`,
    ].join('\n');
  }

  async function finalizeClientBuild(outDir: string): Promise<void> {
    const sections = await mainSections;
    if (sections === null) return;
    const serviceWorkerCodes = fs.existsSync(outDir)
      ? fs
          .readdirSync(outDir)
          .filter((file) => isServiceWorkerFile(file))
          .map((file) => fs.readFileSync(path.join(outDir, file), 'utf8'))
      : [];
    const serviceWorkerEntries =
      serviceWorkerCodes.length === 0
        ? []
        : collectServiceWorkerEntries(serviceWorkerCodes, resolveWorkboxPackage);

    const data = validateLicensesData({
      sections: [
        ...sections.sections,
        ...(serviceWorkerEntries.length === 0 ? [] : [serviceWorkerSection(serviceWorkerEntries)]),
      ],
    });

    patchServiceWorkerLicenses(outDir, serviceWorkerEntries);
    fs.writeFileSync(path.join(outDir, LICENSES_JSON_FILE_NAME), serializeLicensesData(data));
    config.logger.info(
      `licenses: ${data.sections.reduce((total, section) => total + section.entries.length, 0)} 件を ` +
        `${path.relative(config.root, path.join(outDir, LICENSES_JSON_FILE_NAME))} に書き出しました`,
    );
  }

  return {
    name: 'go-tour-pocket:licenses',
    configResolved(resolved) {
      config = resolved;
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return null;
      return loadVirtualModule();
    },
    async generateBundle(_options, bundle) {
      if (!isClientEnvironment(this)) return;
      const chunks = Object.values(bundle).filter((output) => output.type === 'chunk');
      if (!chunks.some((chunk) => chunk.code.includes(LICENSES_DATA_MARKER))) return;

      if (mainSections === null) {
        mainSections = computeMainSections(collectBundledPaths(this.getModuleIds(), bundle));
      }
      renderedLicensesChunk = true;
      const data = await mainSections;
      for (const chunk of chunks) {
        if (!chunk.code.includes(LICENSES_DATA_MARKER)) continue;
        chunk.code = replaceMarker(chunk.code, LICENSES_DATA_MARKER, data);
      }
    },
    closeBundle: {
      order: 'post',
      async handler() {
        if (!isClientEnvironment(this)) return;
        if (config.command !== 'build') return;
        if (!renderedLicensesChunk) return;
        if (!config.build.write) return;
        const outDir = path.resolve(config.root, this.environment.config.build.outDir);
        await finalizeClientBuild(outDir);
      },
    },
  };
}
