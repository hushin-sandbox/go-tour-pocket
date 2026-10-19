import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Check, ChevronRight } from 'lucide-react';
import {
  findCatalogLesson,
  LESSON_MODULES,
  loadLessonCatalog,
  primaryText,
  type CatalogLesson,
  type LessonCatalog,
} from '@/react-app/entities/lesson';
import {
  countReadPages,
  isPageRead,
  useProgress,
  type Progress,
} from '@/react-app/entities/progress';
import { InstallPrompt } from '@/react-app/features/install-prompt';
import { cn } from '@/react-app/shared/lib';
import { Button } from '@/react-app/shared/ui';

type HomePageViewProps = {
  catalog: LessonCatalog;
  progress: Progress;
};

export function HomePage() {
  const progress = useProgress();
  const [catalog, setCatalog] = useState<LessonCatalog | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadLessonCatalog()
      .then((value) => {
        if (!cancelled) setCatalog(value);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <p role="alert" className="mx-auto max-w-xl px-4 pt-8 text-sm text-destructive">
        レッスンを読み込めませんでした。ページを再読み込みしてください。
      </p>
    );
  }

  if (catalog === null) {
    return (
      <p aria-busy="true" className="mx-auto max-w-xl px-4 pt-8 text-sm text-muted-foreground">
        レッスンを読み込み中…
      </p>
    );
  }

  return <HomePageView catalog={catalog} progress={progress} />;
}

export function HomePageView({ catalog, progress }: HomePageViewProps) {
  const lastLesson = progress.lastPage
    ? findCatalogLesson(catalog, progress.lastPage.lessonId)
    : undefined;
  const lastPageTitle =
    lastLesson && progress.lastPage
      ? lastLesson.pageTitles[progress.lastPage.pageIndex]
      : undefined;
  const firstLesson = catalog[0];
  const firstPageTitle = firstLesson?.pageTitles[0];

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-10 px-4 pt-8 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">Go Tour Pocket</h1>
        <p className="text-sm leading-6 text-muted-foreground text-pretty">
          A Tour of Go
          を英日対訳で読めるレッスン一覧です。上から順に読み進めても、気になるレッスンから開いてもかまいません。
        </p>
      </header>

      {lastLesson && lastPageTitle && progress.lastPage ? (
        <section
          aria-labelledby="continue-heading"
          className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm"
        >
          <p id="continue-heading" className="text-xs font-medium text-muted-foreground">
            続きから
          </p>
          <div className="flex flex-col gap-1">
            <p className="text-base font-medium">{primaryText(lastLesson.title)}</p>
            <p className="text-sm text-muted-foreground">
              {primaryText(lastPageTitle)} ・ ページ {progress.lastPage.pageIndex + 1} /{' '}
              {lastLesson.pageTitles.length}
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              className="h-11 px-4"
              render={
                <Link
                  to="/tour/$lesson/$page"
                  params={{
                    lesson: lastLesson.id,
                    page: String(progress.lastPage.pageIndex + 1),
                  }}
                  aria-label={`続きから: ${primaryText(lastLesson.title)} ${primaryText(lastPageTitle)}`}
                />
              }
            >
              続きを読む
            </Button>
          </div>
        </section>
      ) : (
        firstLesson &&
        firstPageTitle && (
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">はじめから</p>
            <p className="text-sm leading-6 text-muted-foreground">
              まずは {primaryText(firstLesson.title)} の「{primaryText(firstPageTitle)}」から。
            </p>
            <div className="flex justify-end">
              <Button
                className="h-11 px-4"
                render={
                  <Link
                    to="/tour/$lesson/$page"
                    params={{ lesson: firstLesson.id, page: '1' }}
                    aria-label={`はじめから: ${primaryText(firstLesson.title)} ${primaryText(firstPageTitle)}`}
                  />
                }
              >
                最初のページを開く
              </Button>
            </div>
          </section>
        )
      )}

      <InstallPrompt />

      {LESSON_MODULES.map((module) => {
        const lessons = module.lessonIds
          .map((lessonId) => findCatalogLesson(catalog, lessonId))
          .filter((lesson): lesson is CatalogLesson => lesson !== undefined);
        if (lessons.length === 0) return null;

        return (
          <section
            key={module.id}
            className="flex flex-col gap-3"
            aria-labelledby={`module-${module.id}`}
          >
            <h2 id={`module-${module.id}`} className="text-sm font-medium text-muted-foreground">
              {module.title}
            </h2>
            <ul className="flex flex-col gap-2">
              {lessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} progress={progress} />
              ))}
            </ul>
          </section>
        );
      })}

      <footer className="flex flex-col gap-4 border-t border-border pt-6">
        <nav aria-label="アプリの情報" className="flex flex-wrap gap-x-5 gap-y-2">
          <a
            href="/about"
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            このアプリについて
          </a>
          <a
            href="/licenses"
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ライセンス
          </a>
        </nav>
        <p className="text-xs leading-5 text-muted-foreground">
          本文は A Tour of Go（CC BY 4.0）を英日対訳にしたものです。
        </p>
      </footer>
    </div>
  );
}

type LessonCardProps = {
  lesson: CatalogLesson;
  progress: Progress;
};

function LessonCard({ lesson, progress }: LessonCardProps) {
  const total = lesson.pageTitles.length;
  const read = countReadPages(progress, lesson.id, total);
  const complete = total > 0 && read === total;
  const percent = total === 0 ? 0 : Math.round((read / total) * 100);

  return (
    <li>
      <details className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums',
              complete
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground',
            )}
            aria-hidden="true"
          >
            {complete ? <Check className="size-4" /> : `${read}/${total}`}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm leading-5 font-medium text-pretty">
              {primaryText(lesson.title)}
            </span>
            {lesson.title.ja !== undefined && (
              <span className="text-xs leading-4 text-muted-foreground">{lesson.title.en}</span>
            )}
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          />
        </summary>

        <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                既読 {read} / {total} ページ
              </span>
              {complete && <span className="font-medium text-link">読了</span>}
            </div>
            <div
              role="progressbar"
              aria-label={`${primaryText(lesson.title)} の進捗`}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={read}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <ol className="flex flex-col">
            {lesson.pageTitles.map((pageTitle, pageIndex) => {
              const pageRead = isPageRead(progress, lesson.id, pageIndex);
              return (
                <li key={`${lesson.id}/${pageIndex}`}>
                  <Link
                    to="/tour/$lesson/$page"
                    params={{ lesson: lesson.id, page: String(pageIndex + 1) }}
                    className="flex min-h-11 items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60"
                  >
                    <span
                      aria-hidden="true"
                      className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground"
                    >
                      {pageIndex + 1}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm leading-5 text-pretty">
                        {primaryText(pageTitle)}
                      </span>
                      {pageTitle.ja !== undefined && (
                        <span className="text-xs leading-4 text-muted-foreground">
                          {pageTitle.en}
                        </span>
                      )}
                    </span>
                    {pageRead && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-link">
                        <Check aria-hidden="true" className="size-3.5" />
                        <span className="sr-only">既読</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </details>
    </li>
  );
}
