/**
 * A Tour of Go の本文・日本語訳・コード例のライセンス表記。
 *
 * 本文は CC BY 4.0 なので全文ではなく、正式な URL へのリンクと要旨を載せる。
 * golang/website の LICENSE（BSD-3-Clause）はビルド時に取得して併記する。
 */
import type { LicenseEntry } from '../../src/shared/licenses.ts';
import { SOURCE_COMMIT, SOURCE_REPOSITORY } from '../content/source.ts';

export const TOUR_URL = 'https://go.dev/tour/';
export const CC_BY_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const GO_TOUR_JP_URL = 'https://github.com/atotto/go-tour-jp';

/** CC BY 4.0 は全文を載せず、正式 URL と要旨で示す。 */
export const CC_BY_SUMMARY = [
  'Creative Commons Attribution 4.0 International（CC BY 4.0）',
  '',
  `ライセンス全文（法的な効力を持つ条件）は ${CC_BY_URL} にあります。`,
  '',
  '要旨: 適切なクレジットを表示し、ライセンスへのリンクを提供し、変更を明示すれば、',
  '商用を含むあらゆる目的で、自由に共有（複製・配布）・翻案（改変・二次利用）できます。',
].join('\n');

export type ContentLicensesInput = {
  /** golang/website の LICENSE（BSD-3-Clause）の全文。 */
  websiteLicense: string;
  /** Go 本体の LICENSE（BSD-3-Clause）の全文。 */
  goLicense: string;
};

export function collectContentEntries(input: ContentLicensesInput): LicenseEntry[] {
  return [
    {
      id: 'content:tour-en',
      name: 'A Tour of Go の本文（英語原文）',
      version: null,
      license: 'CC BY 4.0',
      author: 'The Go Authors',
      url: TOUR_URL,
      text: CC_BY_SUMMARY,
      note:
        `取得元は ${SOURCE_COMMIT}（${SOURCE_REPOSITORY}）の固定コミットです。` +
        'このアプリでは原文を段落に分割して日本語訳を加え、表示形式を変更する改変を行っています。',
      extras: [{ label: 'golang/website の LICENSE（BSD-3-Clause）', text: input.websiteLicense }],
    },
    {
      id: 'content:tour-ja',
      name: '日本語訳',
      version: null,
      license: 'CC BY 4.0',
      author: 'hushin',
      url: null,
      text: CC_BY_SUMMARY,
      note:
        '英語原文からこのアプリのために新たに翻訳したものです。' +
        '原文の翻案として、訳文も原文と同じ CC BY 4.0 で公開します。' +
        `翻訳にあたり、旧訳 go-tour-jp（${GO_TOUR_JP_URL}、BSD-3-Clause、The Go Authors ほか）を参考にしました。`,
      extras: [],
    },
    {
      id: 'content:tour-examples',
      name: 'A Tour of Go のコード例',
      version: null,
      license: 'BSD-3-Clause',
      author: 'The Go Authors',
      url: TOUR_URL,
      text: input.goLicense,
      note:
        `本文と同じく ${SOURCE_COMMIT}（${SOURCE_REPOSITORY}）から取得しています。` +
        'golang.org/x/tour の全文と Go の PATENTS は「Go のランタイムと標準ライブラリ」の節に併記しています。',
      extras: [],
    },
  ];
}
