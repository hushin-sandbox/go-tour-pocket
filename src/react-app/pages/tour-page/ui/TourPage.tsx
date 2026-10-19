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
import { FONT_SIZE_PX, useDisplaySettings } from '@/react-app/features/display-mode';
import { cn } from '@/react-app/shared/lib';
import { CodeRunner } from '@/react-app/widgets/code-runner';
import { usePageShortcuts } from '../model/use-page-shortcuts';
import { PageBlocks } from './PageBlocks';
import { TableOfContents } from './TableOfContentsSheet';
import './tour-page.css';

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
      <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 pt-8">
        <p role="alert" className="text-sm text-destructive">
          ページを読み込めませんでした。
        </p>
        <Link to="/" className="text-sm text-link underline underline-offset-4">
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
      <p aria-busy="true" className="mx-auto max-w-xl px-4 pt-8 text-sm text-muted-foreground">
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
  const { settings } = useDisplaySettings();
  const page = lesson.pages[pageIndex];
  const { prev, next } = adjacentPages(catalog, lesson.id, pageIndex);
  const hasCode = page.code !== undefined;

  usePageShortcuts({ prev, next });

  useEffect(() => {
    recordPageOpened(lesson.id, pageIndex);
    window.scrollTo({ top: 0, left: 0 });
  }, [lesson.id, pageIndex]);

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-xl flex-col px-4 pt-4',
        // コードのあるページだけ、幅の広い画面で 2 カラムぶんの幅を使う
        hasCode && 'lg:max-w-6xl lg:px-6 lg:pt-6',
      )}
    >
      <div
        className={cn(
          'flex flex-col',
          hasCode && 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-10',
        )}
      >
        <div className="flex min-w-0 flex-col">
          <div className="mb-6 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{primaryText(lesson.title)}</p>
              <p className="text-xs text-muted-foreground">
                ページ {pageIndex + 1} / {lesson.pages.length}
              </p>
            </div>
            <TableOfContents lesson={lesson} catalog={catalog} pageIndex={pageIndex} />
          </div>

          <article
            className="flex flex-col gap-7"
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
          </article>
        </div>

        {page.code && (
          <aside className="tour-code-pane mt-8 lg:mt-0 lg:min-h-0 lg:min-w-0">
            <CodeRunner
              code={page.code.content}
              fileName={page.code.name}
              storageKey={`${lesson.id}/${pageIndex}`}
              codeHash={codeHash(page.code.content)}
              layout="fill"
              className="border-t border-border pt-6 lg:h-full lg:border-t-0 lg:pt-0"
            />
          </aside>
        )}
      </div>

      <BottomNavigation prev={prev} next={next} />
    </div>
  );
}

function BottomNavigation({ prev, next }: { prev?: PageRef; next?: PageRef }) {
  return (
    <nav
      aria-label="ページ移動"
      // 固定せず、本文とコードの後ろに普通に置く。スマホの下部は safe-area を空ける。
      className="mt-10 border-t border-border pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-2">
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
  const isPrev = direction === 'prev';
  return (
    <Link
      to="/tour/$lesson/$page"
      params={{ lesson: page.lessonId, page: String(page.pageIndex + 1) }}
      aria-keyshortcuts={isPrev ? 'PageUp' : 'PageDown'}
      className={cn(
        'flex min-h-11 min-w-0 flex-col justify-center rounded-lg border border-border bg-card px-3 py-1.5',
        !isPrev && 'text-right',
      )}
    >
      <span className="text-[0.65rem] font-medium text-muted-foreground">
        {isPrev ? '前へ' : '次へ'}
      </span>
      <span className="w-full truncate text-xs font-medium">{primaryText(page.pageTitle)}</span>
      <span className="w-full truncate text-[0.65rem] text-muted-foreground">
        {primaryText(page.lessonTitle)}
      </span>
    </Link>
  );
}
