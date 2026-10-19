/**
 * 集めたライセンスを 1 つのデータにまとめ、検証して JSON にする。
 */
import type { LicenseEntry, LicensesData } from '../../src/shared/licenses.ts';
import { LICENSE_SECTIONS, licensesDataSchema } from '../../src/shared/licenses.ts';

export type LicenseParts = {
  content: LicenseEntry[];
  go: LicenseEntry[];
  npm: LicenseEntry[];
};

export function assembleLicensesData(parts: LicenseParts): LicensesData {
  return validateLicensesData({
    sections: [
      { id: 'content', ...LICENSE_SECTIONS.content, entries: parts.content },
      { id: 'go', ...LICENSE_SECTIONS.go, entries: parts.go },
      { id: 'npm', ...LICENSE_SECTIONS.npm, entries: parts.npm },
    ],
  });
}

/** スキーマと、id の重複・空のライセンス名を検証する。 */
export function validateLicensesData(value: unknown): LicensesData {
  const data = licensesDataSchema.parse(value);
  const ids = new Set<string>();
  for (const section of data.sections) {
    for (const entry of section.entries) {
      if (ids.has(entry.id)) {
        throw new Error(`ライセンスエントリの id が重複しています: ${entry.id}`);
      }
      ids.add(entry.id);
      if (entry.license.trim() === '') {
        throw new Error(`ライセンス名が空です: ${entry.id}`);
      }
    }
  }
  return data;
}

/** 差分が出ないよう、キーの順序が固定された JSON にする。 */
export function serializeLicensesData(data: LicensesData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
