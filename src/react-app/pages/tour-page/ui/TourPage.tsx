import { useEffect, useState } from 'react';
import { getRouteApi, Link, Navigate } from '@tanstack/react-router';
import {
  adjacentPages,
  codeHash,
  isContentLessonId,
  loadJoinedLesson,
  loadLessonCatalog,
  primaryText,
  type LessonCatalog,
  type LoadedLesson,
  type PageRef,
} from '@/react-app/entities/lesson';
import { recordPageOpened } from '@/react-app/entities/progress';
import {
  DisplayModeSwitcher,
  FONT_SIZE_PX,
  useDisplaySettings,
} from '@/react-app/features/display-mode';
import { cn } from '@/react-app/shared/lib';
import { CodeRunner } from '@/react-app/widgets/code-runner';
import { PageBlocks } from './PageBlocks';
import { TableOfContents } from './TableOfContentsSheet';

const routeApi = getRouteApi('/tour/$lesson/$page');

export function TourPage() {
  const params = routeApi.useParams();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const pageNumber = Number(params.page);

  useEffect(() => {
    const lessonId = params.lesson;
    if (!isContentLessonId(lessonId) || !Number.isInteger(pageNumber) || pageNumber < 1) {
      return undefined;
    }

    let cancelled = false;
    void Promise.all([loadJoinedLesson(lessonId), loadLessonCatalog()])
      .then(([loadedLesson, catalog]) => {
        if (cancelled) return;
        if (pageNumber > loadedLesson.pages.length) {
          setState({ status: 'invalid', lessonId, pageNumber });
          return;
        }
        setState({ status: 'ready', lesson: loadedLesson, catalog, pageNumber });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', lessonId, pageNumber });
      });

    return () => {
      cancelled = true;
    };
  }, [params.lesson, pageNumber]);

  if (!isContentLessonId(params.lesson) || !Number.isInteger(pageNumber) || pageNumber < 1) {
    return <Navigate to="/" replace />;
  }

  if (
    state.status === 'invalid' &&
    state.lessonId === params.lesson &&
    state.pageNumber === pageNumber
  ) {
    return <Navigate to="/" replace />;
  }

  if (
    state.status === 'error' &&
    state.lessonId === params.lesson &&
    state.pageNumber === pageNumber
  ) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        <p role="alert" className="text-sm text-destructive">
          ページを読み込めませんでした。
        </p>
        <Link to="/" className="text-sm text-primary underline underline-offset-4">
          レッスン一覧へ戻る
        </Link>
      </div>
    );
  }

  if (
    state.status !== 'ready' ||
    state.lesson.id !== params.lesson ||
    state.pageNumber !== pageNumber
  ) {
    return (
      <p aria-busy="true" className="mx-auto max-w-xl text-sm text-muted-foreground">
        ページを読み込み中…
      </p>
    );
  }

  return <TourPageView lesson={state.lesson} pageIndex={pageNumber - 1} catalog={state.catalog} />;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'invalid'; lessonId: string; pageNumber: number }
  | { status: 'error'; lessonId: string; pageNumber: number }
  | { status: 'ready'; lesson: LoadedLesson; catalog: LessonCatalog; pageNumber: number };

type TourPageViewProps = {
  lesson: LoadedLesson;
  /** 0 始まり。 */
  pageIndex: number;
  catalog: LessonCatalog;
};

export function TourPageView({ lesson, pageIndex, catalog }: TourPageViewProps) {
  const { settings, setMode, cycleFontSize } = useDisplaySettings();
  const page = lesson.pages[pageIndex];
  const { prev, next } = adjacentPages(catalog, lesson.id, pageIndex);

  useEffect(() => {
    recordPageOpened(lesson.id, pageIndex);
    window.scrollTo({ top: 0, left: 0 });
  }, [lesson.id, pageIndex]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col">
      <header className="sticky top-14 z-40 -mx-4 mb-6 border-b border-border/70 bg-background/90 px-4 pt-2 pb-2 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{primaryText(lesson.title)}</p>
              <p className="text-xs text-muted-foreground">
                ページ {pageIndex + 1} / {lesson.pages.length}
              </p>
            </div>
            <TableOfContents lesson={lesson} catalog={catalog} pageIndex={pageIndex} />
          </div>
          <DisplayModeSwitcher
            mode={settings.mode}
            fontSize={settings.fontSize}
            onModeChange={setMode}
            onFontSizeChange={cycleFontSize}
          />
        </div>
      </header>

      <article
        className="flex flex-col gap-7 pb-28"
        style={{ fontSize: FONT_SIZE_PX[settings.fontSize] }}
      >
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-balance">
            {primaryText(page.title)}
          </h1>
          {page.title.ja !== undefined && (
            <p className="text-sm text-muted-foreground">{page.title.en}</p>
          )}
        </header>

        <PageBlocks page={page} mode={settings.mode} />

        {page.code && (
          <CodeRunner
            code={page.code.content}
            fileName={page.code.name}
            storageKey={`${lesson.id}/${pageIndex}`}
            codeHash={codeHash(page.code.content)}
            className="border-t border-border pt-6"
          />
        )}
      </article>

      <BottomNavigation prev={prev} next={next} />
    </div>
  );
}

function BottomNavigation({ prev, next }: { prev?: PageRef; next?: PageRef }) {
  return (
    <nav
      aria-label="ページ移動"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md"
    >
      <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-2 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {prev ? <PageLink direction="prev" page={prev} /> : <span aria-hidden="true" />}
        {next ? (
          <PageLink direction="next" page={next} />
        ) : (
          <Link
            to="/"
            className="flex min-h-11 flex-col justify-center rounded-lg border border-border bg-card px-3 py-1.5 text-right"
          >
            <span className="text-[0.65rem] font-medium text-muted-foreground">最後まで読了</span>
            <span className="truncate text-xs font-medium">レッスン一覧へ</span>
          </Link>
        )}
      </div>
    </nav>
  );
}

function PageLink({ direction, page }: { direction: 'prev' | 'next'; page: PageRef }) {
  return (
    <Link
      to="/tour/$lesson/$page"
      params={{ lesson: page.lessonId, page: String(page.pageIndex + 1) }}
      className={cn(
        'flex min-h-11 min-w-0 flex-col justify-center rounded-lg border border-border bg-card px-3 py-1.5',
        direction === 'next' && 'text-right',
      )}
    >
      <span className="text-[0.65rem] font-medium text-muted-foreground">
        {direction === 'prev' ? '前へ' : '次へ'}
      </span>
      <span className="w-full truncate text-xs font-medium">{primaryText(page.pageTitle)}</span>
      <span className="w-full truncate text-[0.65rem] text-muted-foreground">
        {primaryText(page.lessonTitle)}
      </span>
    </Link>
  );
}
