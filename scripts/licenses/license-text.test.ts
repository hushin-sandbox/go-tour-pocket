import { describe, expect, it } from 'vitest';
import {
  extractCopyrightHolder,
  identifyLicense,
  identifyLicenses,
  normalizeAuthor,
  normalizeLicenseField,
  normalizeRepositoryUrl,
} from './license-text.ts';

const GO_LICENSE = `Copyright 2009 The Go Authors.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:
   * Neither the name of Google LLC nor the names of its contributors may be used to endorse`;

const APACHE_LICENSE = `                                 Apache License
                           Version 2.0, January 2004

   Copyright [yyyy] [name of copyright owner]`;

describe('identifyLicense', () => {
  it('ライセンス本文から SPDX の名前を推定する', () => {
    expect(
      identifyLicense(
        'Permission is hereby granted, free of charge, to any person obtaining a copy',
      ),
    ).toBe('MIT');
    expect(identifyLicense(APACHE_LICENSE)).toBe('Apache-2.0');
    expect(identifyLicense(GO_LICENSE)).toBe('BSD-3-Clause');
    expect(identifyLicense('Copyright (c) 2020 Someone. All rights reserved.')).toBeNull();
  });

  it('複数の本文は OR でまとめる', () => {
    expect(
      identifyLicenses([
        'Permission is hereby granted, free of charge, to any person obtaining a copy',
        APACHE_LICENSE,
      ]),
    ).toBe('Apache-2.0 OR MIT');
    expect(identifyLicenses(['unknown text'])).toBeNull();
  });
});

describe('extractCopyrightHolder', () => {
  it('Copyright 行から著作者を取り出す', () => {
    expect(extractCopyrightHolder(GO_LICENSE)).toBe('The Go Authors');
    expect(extractCopyrightHolder('Copyright (c) 2011 The Go Authors. All rights reserved.')).toBe(
      'The Go Authors',
    );
    expect(extractCopyrightHolder('Copyright 2015-2017 Traefik Labs <dev@traefik.io>')).toBe(
      'Traefik Labs',
    );
  });

  it('Apache-2.0 の付録のようなプレースホルダは無視する', () => {
    expect(extractCopyrightHolder(APACHE_LICENSE)).toBeNull();
  });

  it('本文中に出てくる copyright owner を著作者と誤認しない', () => {
    expect(
      extractCopyrightHolder(
        '"Licensor" shall mean the copyright owner or entity authorized by\nthe copyright owner that is granting the License.',
      ),
    ).toBeNull();
    expect(extractCopyrightHolder('// Copyright 2020 Someone')).toBe('Someone');
  });

  it('複数の Copyright 行は連結する', () => {
    expect(
      extractCopyrightHolder(
        '   Copyright 2019 Containous SAS\n   Copyright 2020 Traefik Labs SAS',
      ),
    ).toBe('Containous SAS, Traefik Labs SAS');
  });
});

describe('normalizeAuthor', () => {
  it('文字列とオブジェクトの author を名前にする', () => {
    expect(normalizeAuthor('Luke Edwards <luke@example.com> (https://example.com)')).toBe(
      'Luke Edwards',
    );
    expect(normalizeAuthor({ name: 'Meta Platforms, Inc. and affiliates' })).toBe(
      'Meta Platforms, Inc. and affiliates',
    );
    expect(normalizeAuthor(undefined)).toBeNull();
  });
});

describe('normalizeLicenseField', () => {
  it('SPDX の文字列だけを使い、間接参照は null にする', () => {
    expect(normalizeLicenseField('MIT')).toBe('MIT');
    expect(normalizeLicenseField({ type: 'BSD-3-Clause' })).toBe('BSD-3-Clause');
    expect(normalizeLicenseField('SEE LICENSE IN LICENSE.md')).toBeNull();
    expect(normalizeLicenseField('UNLICENSED')).toBeNull();
    expect(normalizeLicenseField(undefined)).toBeNull();
  });
});

describe('normalizeRepositoryUrl', () => {
  it('git の URL を https に直す', () => {
    expect(normalizeRepositoryUrl('git+https://github.com/x/y.git')).toBe('https://github.com/x/y');
    expect(normalizeRepositoryUrl('git://github.com/x/y.git')).toBe('https://github.com/x/y');
    expect(normalizeRepositoryUrl('/local/path')).toBeNull();
  });
});
