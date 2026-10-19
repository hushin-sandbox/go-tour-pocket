import { useInstallPrompt } from '../model/use-install-prompt';
import { InstallPromptView } from './InstallPromptView';

/**
 * インストール導線。置くかどうかはページ側が決める（ホームなど）。
 * 表示条件はブラウザの状態から内部で判定する。
 */
export function InstallPrompt() {
  const { context, install, dismiss } = useInstallPrompt();
  return <InstallPromptView context={context} onInstall={install} onDismiss={dismiss} />;
}
