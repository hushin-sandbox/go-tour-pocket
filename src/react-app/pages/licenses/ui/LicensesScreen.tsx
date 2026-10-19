import { licensesData, serviceWorkerLicenses } from 'virtual:licenses';
import { buildLicensesData } from '../model/licenses';
import { LicensesPage } from './LicensesPage';

/** ビルド時に埋め込まれたライセンスデータを表示する。 */
export function LicensesScreen() {
  return <LicensesPage data={buildLicensesData(licensesData, serviceWorkerLicenses)} />;
}
