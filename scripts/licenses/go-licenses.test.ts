import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  collectGoModuleEntries,
  GO_LIST_ARGS,
  goRuntimeEntry,
  parseGoModuleList,
  readGoToolchainLicenses,
  type GoCommandRunner,
} from './go-licenses.ts';

const tempDirs: string[] = [];

function makeDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-tour-go-license-'));
  tempDirs.push(dir);
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

const GO_LICENSE = `Copyright 2009 The Go Authors.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:
   * Neither the name of Google LLC nor the names of its contributors may be used to endorse`;

const APACHE_LICENSE = `Apache License\nVersion 2.0, January 2004\n\nCopyright [yyyy] [name of copyright owner]`;

describe('parseGoModuleList', () => {
  it('パッケージ単位の出力をモジュール単位にまとめる', () => {
    const output = [
      'golang.org/x/tour\tv0.1.0\t/home/user/go/pkg/mod/golang.org/x/tour@v0.1.0',
      'golang.org/x/tour\tv0.1.0\t/home/user/go/pkg/mod/golang.org/x/tour@v0.1.0',
      '',
      'github.com/traefik/yaegi\tv0.16.2\t/home/user/go/pkg/mod/github.com/traefik/yaegi@v0.16.2',
    ].join('\n');
    expect(parseGoModuleList(output)).toEqual([
      {
        path: 'github.com/traefik/yaegi',
        version: 'v0.16.2',
        dir: '/home/user/go/pkg/mod/github.com/traefik/yaegi@v0.16.2',
      },
      {
        path: 'golang.org/x/tour',
        version: 'v0.1.0',
        dir: '/home/user/go/pkg/mod/golang.org/x/tour@v0.1.0',
      },
    ]);
  });
});

describe('readGoToolchainLicenses', () => {
  it('GOROOT の LICENSE と PATENTS、バージョンを読む', () => {
    const goroot = makeDir({ LICENSE: GO_LICENSE, PATENTS: 'Additional IP Rights Grant' });
    const run: GoCommandRunner = (args) => {
      if (args[1] === 'GOROOT') return `${goroot}\n`;
      if (args[1] === 'GOVERSION') return 'go1.25.5\n';
      throw new Error(`unexpected: ${args.join(' ')}`);
    };
    expect(readGoToolchainLicenses(run)).toEqual({
      version: 'go1.25.5',
      license: GO_LICENSE,
      patents: 'Additional IP Rights Grant',
    });
    expect(goRuntimeEntry(readGoToolchainLicenses(run))).toMatchObject({
      id: 'go:runtime',
      name: 'Go のランタイムと標準ライブラリ、wasm_exec.js',
      version: 'go1.25.5',
      license: 'BSD-3-Clause',
      author: 'The Go Authors',
    });
  });
});

describe('collectGoModuleEntries', () => {
  it('go list の結果からモジュールのエントリを作る', () => {
    const yaegi = makeDir({ LICENSE: APACHE_LICENSE });
    const run: GoCommandRunner = (args, cwd) => {
      expect(args).toEqual(GO_LIST_ARGS);
      expect(cwd).toBe('/repo/wasm');
      return `github.com/traefik/yaegi\tv0.16.2\t${yaegi}\n`;
    };
    expect(collectGoModuleEntries(run, '/repo/wasm')).toEqual([
      {
        id: 'go:github.com/traefik/yaegi',
        name: 'github.com/traefik/yaegi',
        version: 'v0.16.2',
        license: 'Apache-2.0',
        author: null,
        url: 'https://pkg.go.dev/github.com/traefik/yaegi@v0.16.2',
        text: APACHE_LICENSE,
        note: null,
        extras: [],
      },
    ]);
  });

  it('LICENSE が無いモジュールは例外にする', () => {
    const module = makeDir({ 'go.mod': 'module example.com/x' });
    const run: GoCommandRunner = () => `example.com/x\tv1.0.0\t${module}\n`;
    expect(() => collectGoModuleEntries(run, '/repo/wasm')).toThrow(
      'ライセンス全文が見つかりません',
    );
  });

  it('特定できないライセンスは例外にする', () => {
    const module = makeDir({ LICENSE: 'Do not copy.' });
    const run: GoCommandRunner = () => `example.com/x\tv1.0.0\t${module}\n`;
    expect(() => collectGoModuleEntries(run, '/repo/wasm')).toThrow('ライセンスを特定できません');
  });
});
