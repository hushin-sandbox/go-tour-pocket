import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectNpmEntries,
  collectNpmEntry,
  packageDirFromModuleId,
  packageDirsFromModuleIds,
} from './npm-licenses.ts';

const tempDirs: string[] = [];

function makePackage(
  name: string,
  packageJson: Record<string, unknown>,
  files: Record<string, string>,
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'go-tour-license-'));
  tempDirs.push(root);
  const dir = path.join(root, 'node_modules', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', ...packageJson }),
  );
  for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, file), content);
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('packageDirFromModuleId', () => {
  it('pnpm の実体からパッケージのルートを取り出す', () => {
    expect(
      packageDirFromModuleId(
        '/repo/node_modules/.pnpm/react@19.3.0/node_modules/react/jsx-runtime.js',
      ),
    ).toBe('/repo/node_modules/.pnpm/react@19.3.0/node_modules/react');
    expect(
      packageDirFromModuleId(
        '/repo/node_modules/.pnpm/@tanstack+router-core@1.0.0/node_modules/@tanstack/router-core/dist/index.js',
      ),
    ).toBe(
      '/repo/node_modules/.pnpm/@tanstack+router-core@1.0.0/node_modules/@tanstack/router-core',
    );
  });

  it('node_modules 以外やクエリ付きの id を扱う', () => {
    expect(packageDirFromModuleId('/repo/src/react-app/main.tsx')).toBeNull();
    expect(packageDirFromModuleId('/repo/node_modules/pkg/index.js?tsr-split=component')).toBe(
      '/repo/node_modules/pkg',
    );
  });
});

describe('packageDirsFromModuleIds', () => {
  it('重複を除いて並べる', () => {
    expect(
      packageDirsFromModuleIds([
        '/repo/node_modules/a/index.js',
        '/repo/node_modules/a/other.js',
        '/repo/src/main.tsx',
        '/repo/node_modules/b/index.js',
      ]),
    ).toEqual(['/repo/node_modules/a', '/repo/node_modules/b']);
  });
});

describe('collectNpmEntry', () => {
  it('package.json と LICENSE からエントリを作る', () => {
    const dir = makePackage(
      'sample',
      {
        license: 'MIT',
        author: 'Someone <someone@example.com>',
        repository: { type: 'git', url: 'git+https://github.com/example/sample.git' },
      },
      { LICENSE: 'MIT License\n\nCopyright (c) 2020 Someone' },
    );

    expect(collectNpmEntry(dir)).toEqual({
      id: 'npm:sample',
      name: 'sample',
      version: '1.0.0',
      license: 'MIT',
      author: 'Someone',
      url: 'https://github.com/example/sample',
      text: 'MIT License\n\nCopyright (c) 2020 Someone',
      note: null,
      extras: [],
    });
  });

  it('NOTICE は extras に分ける', () => {
    const dir = makePackage(
      'with-notice',
      { license: 'Apache-2.0' },
      {
        LICENSE: 'Apache License\nVersion 2.0, January 2004',
        NOTICE: 'This product includes software developed by Example.',
      },
    );
    const entry = collectNpmEntry(dir);
    expect(entry.license).toBe('Apache-2.0');
    expect(entry.extras).toEqual([
      { label: 'NOTICE', text: 'This product includes software developed by Example.' },
    ]);
  });

  it('LICENSE が無いときは宣言されたライセンスの標準全文を注記付きで使う', () => {
    const dir = makePackage('no-license-file', { license: 'MIT' }, {});
    const entry = collectNpmEntry(dir);
    expect(entry.license).toBe('MIT');
    expect(entry.text).toContain('MIT License');
    expect(entry.text).toContain('no-license-file authors');
    expect(entry.note).toContain('LICENSE ファイルが含まれていない');
  });

  it('ライセンスを特定できないときは例外にする', () => {
    const dir = makePackage('unknown', {}, { LICENSE: 'All rights reserved. Do not copy.' });
    expect(() => collectNpmEntry(dir)).toThrow('ライセンスを特定できません');
  });

  it('LICENSE の全文が無く、標準全文も無いライセンスは例外にする', () => {
    const dir = makePackage('unknown-text', { license: 'Zlib' }, {});
    expect(() => collectNpmEntry(dir)).toThrow('ライセンス全文が見つかりません');
  });
});

describe('collectNpmEntries', () => {
  it('名前順に並べる', () => {
    const a = makePackage('b-package', { license: 'MIT' }, { LICENSE: 'MIT License' });
    const b = makePackage('a-package', { license: 'MIT' }, { LICENSE: 'MIT License' });
    expect(collectNpmEntries([a, b]).map((entry) => entry.name)).toEqual([
      'a-package',
      'b-package',
    ]);
  });
});
