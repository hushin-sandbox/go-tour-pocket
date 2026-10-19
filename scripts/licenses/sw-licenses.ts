/**
 * Service Worker（vite-plugin-pwa が生成する sw.js / workbox-*.js）に
 * 実際にバンドルされた Workbox のモジュールを集める。
 *
 * Workbox のビルドは各モジュールの先頭に `self["workbox:<module>:<version>"]` という
 * マーカーを残すので、生成物からそれを読み取ってパッケージ名に戻す。
 */
import path from 'node:path';
import type { LicenseEntry } from '../../src/shared/licenses.ts';
import { collectNpmEntry } from './npm-licenses.ts';

const WORKBOX_MARKER_PATTERN = /workbox:([a-z0-9-]+):\d+\.\d+\.\d+/g;

/** 生成物に埋め込まれた Workbox モジュール名（`core` など）を取り出す。 */
export function extractWorkboxModules(code: string): string[] {
  const modules = new Set<string>();
  for (const match of code.matchAll(WORKBOX_MARKER_PATTERN)) {
    const name = match[1];
    if (name !== undefined) modules.add(name);
  }
  return [...modules].toSorted();
}

/** パッケージ名からディレクトリを解決する関数。テストでは差し替える。 */
export type WorkboxPackageResolver = (packageName: string) => string | null;

export function collectServiceWorkerEntries(
  codes: string[],
  resolvePackageDir: WorkboxPackageResolver,
): LicenseEntry[] {
  const modules = new Set<string>();
  for (const code of codes) {
    for (const name of extractWorkboxModules(code)) modules.add(name);
  }

  const entries: LicenseEntry[] = [];
  for (const name of [...modules].toSorted()) {
    const packageName = `workbox-${name}`;
    const dir = resolvePackageDir(packageName);
    if (dir === null) {
      throw new Error(
        `Service Worker に含まれる ${packageName} のディレクトリを解決できません。` +
          'workbox のバージョンを確認してください',
      );
    }
    const entry = collectNpmEntry(path.normalize(dir));
    entries.push({ ...entry, id: `service-worker:${entry.name}` });
  }
  return entries.toSorted((a, b) => a.name.localeCompare(b.name));
}
