/**
 * ライセンス本文からライセンス名と著作者を推定するヘルパー。
 *
 * npm の package.json に license フィールドがあればそれを使い、
 * 無い場合や `SEE LICENSE IN ...` のような間接参照のときだけここで推定する。
 * 推定できないときは呼び出し側がビルドを失敗させる。
 */
import { z } from 'zod';

const LICENSE_PATTERNS: { id: string; test: RegExp }[] = [
  { id: 'Apache-2.0', test: /Apache License\s*(?:,)?\s*Version 2\.0/i },
  // 3 条項（"Neither the name" がある）か 2 条項かで分ける。
  {
    id: 'BSD-3-Clause',
    test: /Redistribution and use in source and binary forms[\s\S]*?Neither the name[\s\S]*?may be used to endorse/i,
  },
  {
    id: 'BSD-2-Clause',
    test: /Redistribution and use in source and binary forms[\s\S]*?THIS SOFTWARE IS PROVIDED BY/i,
  },
  {
    id: 'MIT',
    test: /Permission is hereby granted, free of charge, to any person obtaining a copy/i,
  },
  {
    id: 'ISC',
    test: /Permission to use, copy, modify, and\/or distribute this software for any purpose with or without fee/i,
  },
  { id: 'MPL-2.0', test: /Mozilla Public License\s+Version 2\.0/i },
  {
    id: 'Unlicense',
    test: /This is free and unencumbered software released into the public domain/i,
  },
  { id: 'CC0-1.0', test: /CC0 1\.0 Universal/i },
];

/** ライセンス本文から SPDX のライセンス名を推定する。推定できなければ null。 */
export function identifyLicense(text: string): string | null {
  for (const { id, test } of LICENSE_PATTERNS) {
    if (test.test(text)) return id;
  }
  return null;
}

/** 複数のライセンス本文から推定し、`MIT OR Apache-2.0` のようにまとめる。 */
export function identifyLicenses(texts: string[]): string | null {
  const ids = new Set<string>();
  for (const text of texts) {
    const id = identifyLicense(text);
    if (id !== null) ids.add(id);
  }
  if (ids.size === 0) return null;
  return [...ids].toSorted().join(' OR ');
}

/**
 * LICENSE の Copyright 行から著作者名を集める。
 *
 * 例: `Copyright 2009 The Go Authors. All rights reserved.` → `The Go Authors`
 * 複数あるとき（Yaegi など）は `Containous SAS, Traefik Labs SAS` のように連結する。
 * Apache-2.0 の付録（`Copyright [yyyy] [name of copyright owner]`）や
 * 本文中の `copyright notice that is included in ...` のような文章は無視する。
 */
export function extractCopyrightHolder(text: string): string | null {
  const holders = new Set<string>();
  for (const line of text.split('\n')) {
    if (!/^\s*(?:[*#/]+\s*)?copyright\b/i.test(line)) continue;
    if (/\[[^\]]*\]/.test(line)) continue;
    const match =
      /^\s*(?:[*#/]+\s*)?copyright\s*(?:\(c\)|©)?\s*((?:\d{4}(?:\s*[-–,]\s*\d{4})*)\s+)?(.+)/i.exec(
        line,
      );
    if (match === null) continue;
    const raw = match[2];
    if (raw === undefined) continue;
    // 年が無い行は、文章の途中を拾っていないか大文字始まりで確かめる。
    if (match[1] === undefined && !/^[A-Z0-9]/.test(raw.trim())) continue;
    const holder = raw
      .replace(/\s+all rights reserved\.?.*$/i, '')
      .replace(/\s*<\S+?>\s*/g, ' ')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/[.,;]+\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (holder !== '') holders.add(holder);
  }
  return holders.size === 0 ? null : [...holders].join(', ');
}

const authorSchema = z.union([z.string(), z.looseObject({ name: z.string().optional() })]);

/** package.json の author から表示用の著作者名を作る。 */
export function normalizeAuthor(author: unknown): string | null {
  const parsed = authorSchema.safeParse(author);
  if (!parsed.success) return null;
  if (typeof parsed.data === 'string') {
    const name = parsed.data
      .replace(/\s*<[^>]*>/g, '')
      .replace(/\s*\([^)]*\)/g, '')
      .trim();
    return name === '' ? null : name;
  }
  const name = parsed.data.name?.trim() ?? '';
  return name === '' ? null : name;
}

const licenseFieldSchema = z.union([z.string(), z.looseObject({ type: z.string() })]);

/** package.json の license を SPDX の文字列にする。 */
export function normalizeLicenseField(value: unknown): string | null {
  const parsed = licenseFieldSchema.safeParse(value);
  if (!parsed.success) return null;
  const license = typeof parsed.data === 'string' ? parsed.data.trim() : parsed.data.type.trim();
  // `SEE LICENSE IN LICENSE.md` や `UNLICENSED` は本文から推定する。
  if (license === '' || license === 'UNLICENSED' || /^SEE LICEN[CS]E IN\b/i.test(license)) {
    return null;
  }
  return license;
}

/** repository / homepage から表示できる URL を作る。 */
export function normalizeRepositoryUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  const cleaned = value
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^github:/, 'https://github.com/')
    .replace(/\.git$/, '');
  return cleaned.startsWith('http') ? cleaned : null;
}
