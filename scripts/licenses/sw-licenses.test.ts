import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectServiceWorkerEntries, extractWorkboxModules } from './sw-licenses.ts';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makePackage(name: string, license: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-tour-sw-license-'));
  tempDirs.push(dir);
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name, version: '7.4.1', license }),
  );
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT License\n\nCopyright (c) Google LLC');
  return dir;
}

describe('extractWorkboxModules', () => {
  it('生成物のマーカーからモジュール名を取り出す', () => {
    const code =
      'try{self["workbox:core:7.4.0"]&&_()}catch(t){}try{self["workbox:precaching:7.4.0"]&&_()}catch(t){}' +
      'try{self["workbox:core:7.4.0"]&&_()}catch(t){}';
    expect(extractWorkboxModules(code)).toEqual(['core', 'precaching']);
    expect(extractWorkboxModules('no markers here')).toEqual([]);
  });
});

describe('collectServiceWorkerEntries', () => {
  it('バンドルされたモジュールのパッケージを集める', () => {
    const core = makePackage('workbox-core', 'MIT');
    const entries = collectServiceWorkerEntries(
      ['self["workbox:core:7.4.0"]&&_()', 'self["workbox:routing:7.4.0"]&&_()'],
      (packageName) => {
        if (packageName === 'workbox-core') return core;
        if (packageName === 'workbox-routing') return makePackage(packageName, 'MIT');
        return null;
      },
    );
    expect(entries.map((entry) => entry.id)).toEqual([
      'service-worker:workbox-core',
      'service-worker:workbox-routing',
    ]);
    expect(entries[0]?.license).toBe('MIT');
  });

  it('パッケージを解決できないときは例外にする', () => {
    expect(() =>
      collectServiceWorkerEntries(['self["workbox:core:7.4.0"]&&_()'], () => null),
    ).toThrow('ディレクトリを解決できません');
  });
});
