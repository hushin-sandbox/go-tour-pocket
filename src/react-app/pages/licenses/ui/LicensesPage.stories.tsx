import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { expect, within } from 'storybook/test';
import type { LicensesData } from '@/shared/licenses';
import { LicensesPage } from './LicensesPage';

const DATA: LicensesData = {
  sections: [
    {
      id: 'content',
      title: 'コンテンツ',
      description: 'A Tour of Go の本文・日本語訳・コード例のライセンスです。',
      entries: [
        {
          id: 'content:tour-en',
          name: 'A Tour of Go の本文（英語原文）',
          version: null,
          license: 'CC BY 4.0',
          author: 'The Go Authors',
          url: 'https://go.dev/tour/',
          text: 'Creative Commons Attribution 4.0 International（CC BY 4.0）\n\n要旨: 出典を表示すれば共有・翻案できます。',
          note: '段落に分割し、日本語訳を追加し、表示形式を変更しています。',
          extras: [
            {
              label: 'golang/website の LICENSE（BSD-3-Clause）',
              text: 'Copyright 2009 The Go Authors.',
            },
          ],
        },
      ],
    },
    {
      id: 'go',
      title: 'Go のランタイムと標準ライブラリ',
      description: 'wasm（Yaegi）と、そのビルドに使われたモジュールのライセンスです。',
      entries: [
        {
          id: 'go:all',
          name: 'Go のランタイムと標準ライブラリ、wasm_exec.js',
          version: 'go1.25.5',
          license: 'BSD-3-Clause',
          author: 'The Go Authors',
          url: 'https://go.dev/',
          text: 'Copyright 2009 The Go Authors. All rights reserved.\n\nRedistribution and use in source and binary forms...',
          note: null,
          extras: [{ label: 'PATENTS', text: 'Additional IP Rights Grant...' }],
        },
      ],
    },
    {
      id: 'npm',
      title: 'npm パッケージ',
      description: '実際にバンドルされた npm パッケージのライセンスです。',
      entries: [
        {
          id: 'npm:react',
          name: 'react',
          version: '19.3.0',
          license: 'MIT',
          author: 'Meta Platforms, Inc. and affiliates',
          url: 'https://react.dev/',
          text: 'MIT License\n\nCopyright (c) Meta Platforms, Inc. and affiliates.',
          note: null,
          extras: [],
        },
      ],
    },
    {
      id: 'service-worker',
      title: 'Service Worker（Workbox）',
      description: 'Service Worker にバンドルされた Workbox のライセンスです。',
      entries: [
        {
          id: 'service-worker:workbox-core',
          name: 'workbox-core',
          version: '7.4.1',
          license: 'MIT',
          author: "Google's Web DevRel Team and Google's Aurora Team",
          url: 'https://github.com/GoogleChrome/workbox',
          text: 'MIT License\n\nCopyright (c) Google LLC.',
          note: null,
          extras: [],
        },
      ],
    },
  ],
};

const meta = {
  component: LicensesPage,
  args: { data: DATA },
} satisfies Meta<typeof LicensesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: 'ライセンス', level: 1 })).toBeVisible();

    // 要約表に対象・ライセンス・著作者・リンクが並ぶ
    const table = canvas.getByRole('table', { name: 'ライセンスの要約' });
    await expect(within(table).getByRole('rowheader', { name: 'react 19.3.0' })).toBeVisible();
    await expect(within(table).getByRole('link', { name: 'react.dev' })).toHaveAttribute(
      'href',
      'https://react.dev/',
    );
    await expect(within(table).getByRole('columnheader', { name: '著作者・リンク' })).toBeVisible();
    await expect(
      within(table).getByRole('rowheader', { name: 'A Tour of Go の本文（英語原文）' }),
    ).toBeVisible();
    await expect(within(table).getAllByText('The Go Authors')[0]).toBeVisible();

    // 全文は折りたたまれていて、開くと読める
    const detailsElement = canvas.getByText('react 19.3.0').closest('details');
    if (detailsElement === null) throw new Error('react の details が見つかりません');
    const details = within(detailsElement);
    await expect(details.queryByText('MIT の全文')).not.toBeVisible();
    await userEvent.click(canvas.getByText('react 19.3.0'));
    await expect(details.getByText('MIT の全文')).toBeVisible();
    await expect(details.getByText('著作者: Meta Platforms, Inc. and affiliates')).toBeVisible();

    // もう一度押すと閉じる
    await userEvent.click(canvas.getByText('react 19.3.0'));
    await expect(details.queryByText('MIT の全文')).not.toBeVisible();
  },
};
