import type { LicensesData } from '@/shared/licenses';
import {
  parseLicensesData,
  parseServiceWorkerLicenses,
  serviceWorkerSection,
} from '@/shared/licenses';

/**
 * `virtual:licenses` から渡ってきた値を、ページで使う形にまとめる。
 *
 * Service Worker の分はビルドの最後に生成されるため、別の値として渡ってくる。
 */
export function buildLicensesData(main: unknown, serviceWorker: unknown): LicensesData {
  const data = parseLicensesData(main);
  const entries = parseServiceWorkerLicenses(serviceWorker);
  if (entries.length === 0) return data;
  return { sections: [...data.sections, serviceWorkerSection(entries)] };
}
