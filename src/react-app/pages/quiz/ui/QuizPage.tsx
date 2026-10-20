import { useEffect, useRef, useState } from 'react';
import { getRouteApi, Link, Navigate } from '@tanstack/react-router';
import { Check, X } from 'lucide-react';
import {
  isContentLessonId,
  loadJoinedLesson,
  primaryText,
  type LoadedLesson,
} from '@/react-app/entities/lesson';
import { hasLessonQuiz, loadLessonQuiz, shuffleQuiz } from '@/react-app/entities/quiz';
import { cn } from '@/react-app/shared/lib';
import { Button, InlineText } from '@/react-app/shared/ui';
import type { QuizQuestion } from '@/shared/content';
import { parseQuizText } from '@/shared/quiz-text';

const routeApi = getRouteApi('/quiz/$lesson');

export function QuizPage() {
  const params = routeApi.useParams();
  const lessonId = params.lesson;
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (!isContentLessonId(lessonId) || !hasLessonQuiz(lessonId)) return undefined;

    let cancelled = false;
    void Promise.all([loadJoinedLesson(lessonId), loadLessonQuiz(lessonId)])
      .then(([lesson, quiz]) => {
        if (cancelled) return;
        if (quiz === undefined || quiz.questions.length === 0) {
          setState({ status: 'invalid', lessonId });
          return;
        }
        // シャッフルは読み込み時に 1 回だけ。表示側は渡された順のまま描く。
        setState({ status: 'ready', lessonId, lesson, questions: shuffleQuiz(quiz.questions) });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', lessonId });
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  if (!isContentLessonId(lessonId) || !hasLessonQuiz(lessonId)) {
    return <Navigate to="/" replace />;
  }

  if (state.status === 'invalid' && state.lessonId === lessonId) {
    return <Navigate to="/" replace />;
  }

  if (state.status === 'error' && state.lessonId === lessonId) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 pt-8">
        <p role="alert" className="text-sm text-destructive">
          確認問題を読み込めませんでした。
        </p>
        <Link to="/" className="text-sm text-link underline underline-offset-4">
          レッスン一覧へ戻る
        </Link>
      </div>
    );
  }

  if (state.status !== 'ready' || state.lessonId !== lessonId) {
    return (
      <p aria-busy="true" className="mx-auto max-w-xl px-4 pt-8 text-sm text-muted-foreground">
        確認問題を読み込み中…
      </p>
    );
  }

  return <QuizPageView key={state.lessonId} lesson={state.lesson} questions={state.questions} />;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'invalid'; lessonId: string }
  | { status: 'error'; lessonId: string }
  | { status: 'ready'; lessonId: string; lesson: LoadedLesson; questions: QuizQuestion[] };

type QuizPageViewProps = {
  lesson: LoadedLesson;
  /** 表示順に並べ替え済みの問題（シャッフルは読み込み側で 1 回だけ行う）。 */
  questions: QuizQuestion[];
};

export function QuizPageView({ lesson, questions }: QuizPageViewProps) {
  const [run, setRun] = useState<QuizRun>(() => startRun(questions));
  const feedbackRef = useRef<HTMLDivElement>(null);

  const question = run.questions[run.index];
  const answer = run.answers[run.index];

  // 画面を開いたときは先頭から。出題・結果の切り替えはハンドラ側でスクロールする。
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  // 回答すると選択肢が disabled になりフォーカスが外れるので、代わりにフィードバックへ移す。
  useEffect(() => {
    if (answer !== undefined) feedbackRef.current?.focus();
  }, [answer]);

  function selectChoice(choiceIndex: number): void {
    setRun((current) => {
      if (current.answers[current.index] !== undefined) return current;
      const currentQuestion = current.questions[current.index];
      if (currentQuestion === undefined) return current;
      const answers = [...current.answers];
      answers[current.index] = {
        selectedIndex: choiceIndex,
        correct: choiceIndex === currentQuestion.answer,
      };
      return { ...current, answers };
    });
  }

  function showNext(): void {
    window.scrollTo({ top: 0, left: 0 });
    setRun((current) => {
      if (current.answers[current.index] === undefined) return current;
      if (current.index + 1 >= current.questions.length) return { ...current, finished: true };
      return { ...current, index: current.index + 1 };
    });
  }

  function retryWrong(): void {
    window.scrollTo({ top: 0, left: 0 });
    setRun((current) => {
      const wrong = current.questions.filter((_, index) => !current.answers[index]?.correct);
      return startRun(shuffleQuiz(wrong));
    });
  }

  function restart(): void {
    window.scrollTo({ top: 0, left: 0 });
    setRun(startRun(shuffleQuiz(questions)));
  }

  if (run.questions.length === 0) {
    return (
      <p className="mx-auto max-w-xl px-4 pt-8 text-sm text-muted-foreground">
        このレッスンの確認問題はまだありません。
      </p>
    );
  }

  if (run.finished || question === undefined) {
    return (
      <QuizResultView
        lesson={lesson}
        questions={run.questions}
        answers={run.answers}
        onRetryWrong={retryWrong}
        onRestart={restart}
      />
    );
  }

  const isLast = run.index + 1 >= run.questions.length;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-xs font-medium text-muted-foreground">確認問題</p>
          <p className="truncate text-sm font-medium">{primaryText(lesson.title)}</p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
          問 {run.index + 1} / {run.questions.length}
        </p>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="quiz-question">
        <h1
          id="quiz-question"
          className="text-xl leading-snug font-semibold tracking-tight text-balance"
        >
          <InlineText tokens={parseQuizText(question.prompt)} />
        </h1>

        {question.code !== undefined && (
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
            <code>{question.code}</code>
          </pre>
        )}

        <ul className="flex flex-col gap-2" aria-label="選択肢">
          {question.choices.map((choice, choiceIndex) => {
            const answered = answer !== undefined;
            const isCorrectChoice = answered && choiceIndex === question.answer;
            const isSelected = answer?.selectedIndex === choiceIndex;
            return (
              <li key={choiceIndex}>
                <button
                  type="button"
                  disabled={answered}
                  onClick={() => selectChoice(choiceIndex)}
                  className={cn(
                    'flex min-h-11 w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm leading-6 text-pretty transition-colors',
                    'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    !answered && 'border-border bg-card hover:bg-muted/60',
                    answered && !isCorrectChoice && !isSelected && 'border-border bg-card',
                    isCorrectChoice && 'border-primary bg-primary/10',
                    isSelected && !isCorrectChoice && 'border-destructive bg-destructive/10',
                    answered && 'cursor-default',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <InlineText tokens={parseQuizText(choice)} />
                  </span>
                  {isCorrectChoice && (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-link">
                      <Check aria-hidden="true" className="size-4" />
                      <span className="sr-only">正解の選択肢</span>
                    </span>
                  )}
                  {isSelected && !isCorrectChoice && (
                    <X aria-hidden="true" className="size-4 shrink-0 text-destructive" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {answer !== undefined && (
        <div
          ref={feedbackRef}
          role="status"
          tabIndex={-1}
          className={cn(
            'flex flex-col gap-2 rounded-xl border px-4 py-3 outline-none',
            answer.correct
              ? 'border-primary/40 bg-primary/5'
              : 'border-destructive/40 bg-destructive/5',
          )}
        >
          <p
            className={cn(
              'flex items-center gap-1.5 text-sm font-semibold',
              answer.correct ? 'text-link' : 'text-destructive',
            )}
          >
            {answer.correct ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <X aria-hidden="true" className="size-4" />
            )}
            {answer.correct ? '正解' : '不正解'}
          </p>
          <p className="text-sm leading-6 text-pretty">
            <InlineText tokens={parseQuizText(question.explanation)} />
          </p>
          <PageLink lesson={lesson} pageIndex={question.pageIndex} />
        </div>
      )}

      {answer !== undefined && (
        <div className="flex justify-end">
          <Button className="h-11 px-4" onClick={showNext}>
            {isLast ? '結果を見る' : '次の問題'}
          </Button>
        </div>
      )}
    </div>
  );
}

type Answer = {
  /** 表示中の choices（シャッフル後）の index。 */
  selectedIndex: number;
  correct: boolean;
};

type QuizRun = {
  questions: QuizQuestion[];
  index: number;
  /** index までの回答。未回答の index は空く。 */
  answers: Answer[];
  finished: boolean;
};

function startRun(questions: QuizQuestion[]): QuizRun {
  return { questions, index: 0, answers: [], finished: false };
}

type QuizResultViewProps = {
  lesson: LoadedLesson;
  questions: QuizQuestion[];
  answers: Answer[];
  onRetryWrong: () => void;
  onRestart: () => void;
};

function QuizResultView({
  lesson,
  questions,
  answers,
  onRetryWrong,
  onRestart,
}: QuizResultViewProps) {
  const total = questions.length;
  const correct = questions.filter((_, index) => answers[index]?.correct).length;
  const wrong = questions.filter((_, index) => !answers[index]?.correct);
  const allCorrect = wrong.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="flex flex-col">
        <p className="truncate text-xs font-medium text-muted-foreground">確認問題</p>
        <p className="truncate text-sm font-medium">{primaryText(lesson.title)}</p>
      </div>

      <section
        aria-labelledby="quiz-result"
        className="flex flex-col gap-2 rounded-xl border border-border bg-card px-5 py-4 shadow-sm"
      >
        <h1
          id="quiz-result"
          className="text-2xl font-semibold tracking-tight tabular-nums text-balance"
        >
          {total} 問中 {correct} 問正解
        </h1>
        <p className="text-sm leading-6 text-muted-foreground text-pretty">
          {allCorrect
            ? '全問正解です。このレッスンの内容はしっかり身についています。'
            : '間違えた問題は、根拠のページを読み返してから解き直すと定着します。'}
        </p>
      </section>

      {!allCorrect && (
        <section aria-labelledby="quiz-wrong" className="flex flex-col gap-2">
          <h2 id="quiz-wrong" className="text-xs font-medium text-muted-foreground">
            間違えた問題
          </h2>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {wrong.map((question, index) => (
              <li key={`${question.id}-${index}`} className="flex flex-col gap-1 px-4 py-3">
                <p className="text-sm leading-6 text-pretty">
                  <InlineText tokens={parseQuizText(question.prompt)} />
                </p>
                <PageLink lesson={lesson} pageIndex={question.pageIndex} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!allCorrect && (
          <Button className="h-11 px-4" onClick={onRetryWrong}>
            間違えた問題を解き直す
          </Button>
        )}
        <Button variant="outline" className="h-11 px-4" onClick={onRestart}>
          もう一度
        </Button>
        <Button variant="ghost" className="h-11 px-4" render={<Link to="/" />}>
          レッスン一覧へ
        </Button>
      </div>
    </div>
  );
}

type PageLinkProps = {
  lesson: LoadedLesson;
  pageIndex: number;
};

/** 問題の根拠ページへの導線。問題データの pageIndex が壊れていたら何も出さない。 */
function PageLink({ lesson, pageIndex }: PageLinkProps) {
  const page = lesson.pages[pageIndex];
  if (page === undefined) return null;

  return (
    <Link
      to="/tour/$lesson/$page"
      params={{ lesson: lesson.id, page: String(pageIndex + 1) }}
      className="inline-flex min-h-11 items-center text-sm font-medium text-link underline decoration-link/50 underline-offset-4 hover:decoration-link"
    >
      ページ {pageIndex + 1}『{primaryText(page.title)}』を読み返す
    </Link>
  );
}
