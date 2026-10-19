import { useEffect } from 'react';
import { requestPersistentStorage } from '@/react-app/shared/lib';

/**
 * iOS Safari は操作のないストレージを 7 日で削除するため、アプリ起動時に
 * 永続化を要求する。許可されないブラウザもあるが、失敗しても動作に影響はない。
 *
 * モジュールの読み込み時ではなく React のマウント後に呼ぶ（Storybook など
 * ブラウザ API が揃っていない環境で import しただけで走らせないため）。
 */
export function usePersistentStorage(): void {
  useEffect(() => {
    void requestPersistentStorage();
  }, []);
}
