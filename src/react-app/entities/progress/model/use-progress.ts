import { useEffect, useState } from 'react';
import type { ContentLessonId } from '@/shared/content';
import {
  markPageOpened,
  PROGRESS_STORAGE_KEY,
  readProgress,
  writeProgress,
  type Progress,
} from './progress';

const PROGRESS_CHANGED_EVENT = 'gotour:progress-changed';

/** ページを開いたことを記録し、同じタブの購読者（ホーム等）に通知する。 */
export function recordPageOpened(lessonId: ContentLessonId, pageIndex: number): void {
  const next = markPageOpened(readProgress(), lessonId, pageIndex);
  writeProgress(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PROGRESS_CHANGED_EVENT));
  }
}

/**
 * localStorage の進捗を購読する。ページ遷移でコンポーネントが作り直されるほか、
 * 同一タブ内の更新は独自イベント、別タブの更新は storage イベントで反映する。
 */
export function useProgress(): Progress {
  const [progress, setProgress] = useState<Progress>(() => readProgress());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => setProgress(readProgress());
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === PROGRESS_STORAGE_KEY) update();
    };
    window.addEventListener(PROGRESS_CHANGED_EVENT, update);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PROGRESS_CHANGED_EVENT, update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return progress;
}
