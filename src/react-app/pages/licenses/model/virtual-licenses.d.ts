declare module 'virtual:licenses' {
  /** content / go / npm のセクション。ビルド時にライセンスデータへ置き換わる。 */
  export const licensesData: unknown;
  /** Service Worker（Workbox）のライセンスエントリ。 */
  export const serviceWorkerLicenses: unknown;
}
