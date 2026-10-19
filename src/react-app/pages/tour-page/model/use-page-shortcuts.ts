import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { PageRef } from '@/react-app/entities/lesson';

/**
 * キー入力をページ送りに使ってはいけない要素。
 * CodeMirror は .cm-content（contenteditable）にフォーカスが入るので、
 * 入力欄と同じ扱いにする。
 */
const EDITING_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '[role="textbox"]',
  '.cm-editor',
].join(',');

/** 入力中、または目次シート（dialog）の中にいるときはページ送りより入力を優先する。 */
export function isEditingContext(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  return node.closest(EDITING_SELECTOR) !== null || node.closest('dialog[open]') !== null;
}

type PageShortcutOptions = {
  prev?: PageRef;
  next?: PageRef;
};

/**
 * レッスン画面の PageUp / PageDown。下部ナビ（前へ・次へ）と同じページへ移動する。
 * 要素にフォーカスが無い（body の）ときだけ働かせ、入力中やエディタ編集中は奪わない。
 */
export function usePageShortcuts({ prev, next }: PageShortcutOptions): void {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'PageUp' && event.key !== 'PageDown') return;
      if (isEditingContext(event.target) || isEditingContext(document.activeElement)) return;

      const target = event.key === 'PageUp' ? prev : next;
      if (target === undefined) return;

      // ブラウザ既定のスクロールに任せず、前後のページへ切り替える
      event.preventDefault();
      void navigate({
        to: '/tour/$lesson/$page',
        params: { lesson: target.lessonId, page: String(target.pageIndex + 1) },
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, prev, next]);
}
