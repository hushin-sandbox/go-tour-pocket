/**
 * `/licenses` の DTO。
 *
 * ビルド時に `scripts/licenses` が生成し、ページ（react-app）が読むので、
 * worker と react-app の共通コードと同じく、ここには型と定数だけを置く。
 */
import { z } from 'zod';

/** セクションの区分。並び順もこの順で表示する。 */
export const LICENSE_SECTION_IDS = ['content', 'go', 'npm', 'service-worker'] as const;

export type LicenseSectionId = (typeof LICENSE_SECTION_IDS)[number];

/** LICENSE 以外に併記する文書（Go の PATENTS、Apache-2.0 の NOTICE など）。 */
export const licenseExtraSchema = z.object({
  label: z.string(),
  text: z.string(),
});

export const licenseEntrySchema = z.object({
  /** レンダリングの key に使う安定した id（`npm:react` など）。 */
  id: z.string(),
  /** 対象の名前（パッケージ名や「A Tour of Go の本文（英語原文）」）。 */
  name: z.string(),
  version: z.string().nullable(),
  /** ライセンス名（`MIT`、`Apache-2.0`、`CC BY 4.0` など）。 */
  license: z.string(),
  author: z.string().nullable(),
  url: z.string().nullable(),
  /** ライセンス全文。全文を載せない場合（CC BY 4.0 など）は null。 */
  text: z.string().nullable(),
  /** 改変内容やクレジットなどの補足。 */
  note: z.string().nullable(),
  extras: z.array(licenseExtraSchema),
});

export const licenseSectionSchema = z.object({
  id: z.enum(LICENSE_SECTION_IDS),
  title: z.string(),
  description: z.string(),
  entries: z.array(licenseEntrySchema),
});

export const licensesDataSchema = z.object({
  sections: z.array(licenseSectionSchema),
});

/** Service Worker の生成物（sw.js / workbox-*.js）から集めた Workbox のエントリ。 */
export const serviceWorkerLicensesSchema = z.array(licenseEntrySchema);

export type LicenseExtra = z.infer<typeof licenseExtraSchema>;
export type LicenseEntry = z.infer<typeof licenseEntrySchema>;
export type LicenseSection = z.infer<typeof licenseSectionSchema>;
export type LicensesData = z.infer<typeof licensesDataSchema>;

/**
 * `virtual:licenses` から渡ってくる値を検証する。
 *
 * ビルド時に `scripts/licenses` が同じスキーマで検証しているので、
 * ここは壊れた JSON を早期に落とすための保険。
 */
export function parseLicensesData(value: unknown): LicensesData {
  return licensesDataSchema.parse(value);
}

export function parseServiceWorkerLicenses(value: unknown): LicenseEntry[] {
  return serviceWorkerLicensesSchema.parse(value);
}

/** セクションの見出しと説明。ビルド時の生成物にも同じ文言を埋め込む。 */
export const LICENSE_SECTIONS: Record<LicenseSectionId, { title: string; description: string }> = {
  content: {
    title: 'コンテンツ',
    description: 'A Tour of Go の本文・日本語訳・コード例のライセンスです。',
  },
  go: {
    title: 'Go のランタイムと標準ライブラリ',
    description:
      'ブラウザ内でコードを実行する wasm（Yaegi）と、そのビルドに使われたモジュールのライセンスです。',
  },
  npm: {
    title: 'npm パッケージ',
    description: 'フロントエンドのビルドで実際にバンドルされた npm パッケージのライセンスです。',
  },
  'service-worker': {
    title: 'Service Worker（Workbox）',
    description: 'オフライン用の Service Worker にバンドルされた Workbox のライセンスです。',
  },
};

/** Service Worker 分をまとめるときに使うセクション定義。 */
export function serviceWorkerSection(entries: LicenseEntry[]): LicenseSection {
  return {
    id: 'service-worker',
    ...LICENSE_SECTIONS['service-worker'],
    entries,
  };
}
