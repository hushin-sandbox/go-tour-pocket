import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import {
  findCatalogLesson,
  LESSON_MODULES,
  primaryText,
  type JoinedLesson,
  type LessonCatalog,
} from '@/react-app/entities/lesson';
import { Button } from '@/react-app/shared/ui';

type TableOfContentsProps = {
  lesson: JoinedLesson;
  catalog: LessonCatalog;
  pageIndex: number;
};

/** 上部バーの目次ボタンとボトムシート。 */
export function TableOfContents({ lesson, catalog, pageIndex }: TableOfContentsProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="min-h-11 shrink-0 px-3"
      >
        目次
      </Button>
      <ContentsSheet
        open={open}
        onOpenChange={setOpen}
        lesson={lesson}
        catalog={catalog}
        pageIndex={pageIndex}
      />
    </>
  );
}

type ContentsSheetProps = TableOfContentsProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function ContentsSheet({ open, onOpenChange, lesson, catalog, pageIndex }: ContentsSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="toc-heading"
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none rounded-t-2xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50 sm:mx-auto sm:max-w-xl"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 id="toc-heading" className="text-base font-semibold">
            目次
          </h2>
          <button
            type="button"
            aria-label="目次を閉じる"
            onClick={() => onOpenChange(false)}
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-7 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <section className="flex flex-col gap-2" aria-labelledby="toc-current-lesson">
            <div className="flex flex-col gap-0.5">
              <h3 id="toc-current-lesson" className="text-xs font-medium text-muted-foreground">
                このレッスン
              </h3>
              <p className="text-sm font-medium">{primaryText(lesson.title)}</p>
            </div>
            <ol className="flex flex-col">
              {lesson.pages.map((pageTitle, index) => (
                <li key={`${lesson.id}/${index}`}>
                  <Link
                    to="/tour/$lesson/$page"
                    params={{ lesson: lesson.id, page: String(index + 1) }}
                    aria-current={index === pageIndex ? 'page' : undefined}
                    onClick={() => onOpenChange(false)}
                    className="flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:font-medium"
                  >
                    <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">{primaryText(pageTitle.title)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="toc-other-lessons">
            <h3 id="toc-other-lessons" className="text-xs font-medium text-muted-foreground">
              ほかのレッスン
            </h3>
            {LESSON_MODULES.map((module) => {
              const lessons = module.lessonIds
                .map((lessonId) => findCatalogLesson(catalog, lessonId))
                .filter((entry) => entry !== undefined);
              if (lessons.length === 0) return null;
              return (
                <div key={module.id} className="flex flex-col gap-1">
                  <p className="px-2 text-xs font-medium text-muted-foreground">{module.title}</p>
                  <ul className="flex flex-col">
                    {lessons.map((entry) => {
                      const current = entry.id === lesson.id;
                      return (
                        <li key={entry.id}>
                          <Link
                            to="/tour/$lesson/$page"
                            params={{ lesson: entry.id, page: '1' }}
                            onClick={() => onOpenChange(false)}
                            className="flex min-h-11 items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm">{primaryText(entry.title)}</span>
                              <span className="block text-xs text-muted-foreground">
                                {entry.pageTitles.length} ページ
                              </span>
                            </span>
                            {current && (
                              <span className="shrink-0 text-xs font-medium text-primary">
                                表示中
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>

          <div className="border-t border-border pt-3">
            <a
              href="/licenses"
              className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ライセンス
            </a>
          </div>
        </div>
      </div>
    </dialog>
  );
}
