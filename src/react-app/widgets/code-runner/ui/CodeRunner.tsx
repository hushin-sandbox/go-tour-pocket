import { useEffect, useMemo, useRef, useState } from 'react';
import { AlignLeft, ChevronDown, FileCode2, Play, RotateCcw, Square, WrapText } from 'lucide-react';
import {
  DEFAULT_GO_TIMEOUT_MS,
  cn,
  formatGo,
  preloadGo,
  runGo,
  type GoFormatResult,
  type GoRunEvent,
  type GoRunResult,
} from '@/react-app/shared/lib';
import { Button } from '@/react-app/shared/ui';
import { appendRunEvent } from '../lib/runOutput';
import {
  CODE_FONT_SIZE_OPTIONS,
  clearDraft,
  loadCodeFontSize,
  loadCodeWrap,
  loadDraft,
  saveCodeFontSize,
  saveCodeWrap,
  saveDraft,
  type CodeFontSize,
  type KeyValueStorage,
} from '../lib/storage';
import { CodeEditor, type CodeEditorHandle } from './CodeEditor';
import { RunOutput, type GoLoadState } from './RunOutput';
import './codeRunner.css';

const DRAFT_SAVE_DELAY_MS = 400;
const DEFAULT_CONFIRM_MESSAGE = '編集したコードを破棄して、元のコードに戻しますか？';

/** テストや Storybook から実行エンジンを差し替えるための境界。 */
export interface GoRunnerEngine {
  preload: typeof preloadGo;
  run: typeof runGo;
  format: typeof formatGo;
}

export interface CodeRunnerProps {
  /** レッスンに掲載されている原文のコード */
  code: string;
  /** エディタ上部に出すファイル名（例 "packages.go"） */
  fileName: string;
  /** 下書き保存のキー（例 "basics/1"） */
  storageKey: string;
  /** 原文コードの識別子。保存した下書きを捨てるかの判定に使う */
  codeHash: string;
  /** 実行のタイムアウト。既定は 10 秒 */
  timeoutMs?: number;
  /** 実行エンジン。省略時は shared/lib の wasm ランナーを使う */
  engine?: GoRunnerEngine;
  /**
   * `fill` は親の高さいっぱいに広げ、エディタと実行結果をそれぞれ内部スクロールさせる
   * （幅の広い画面の 2 カラム右側で使う）。既定は本文に埋め込む `inline`。
   */
  layout?: 'inline' | 'fill';
  className?: string;
}

const defaultEngine: GoRunnerEngine = { preload: preloadGo, run: runGo, format: formatGo };

function getBrowserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    // Safari のプライベートモードなど、localStorage へのアクセス自体が失敗する環境
    return null;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 折り返しの保存値がないときの初期値。スマホ幅では長い行がはみ出すため
 * 折り返しを既定でオンにする。matchMedia がない環境ではオフ。
 */
function prefersWrapByDefault(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 767px)').matches
    : false;
}

/**
 * レッスン画面に埋め込む Go のコード実行ウィジェット。
 *
 * storageKey / codeHash が変わったら別の下書きとして扱いたいので、外側で key を
 * 付けて内側の state を作り直す。
 */
export function CodeRunner(props: CodeRunnerProps) {
  return <CodeRunnerContent key={`${props.storageKey}\u0000${props.codeHash}`} {...props} />;
}

function CodeRunnerContent({
  code: originalCode,
  fileName,
  storageKey,
  codeHash,
  timeoutMs = DEFAULT_GO_TIMEOUT_MS,
  engine: engineProp,
  layout = 'inline',
  className,
}: CodeRunnerProps) {
  const isFilled = layout === 'fill';
  const storage = useMemo(() => getBrowserStorage(), []);
  const engineRef = useRef<GoRunnerEngine>(engineProp ?? defaultEngine);

  const [code, setCode] = useState(() => {
    if (storage === null) return originalCode;
    return loadDraft(storage, storageKey, codeHash) ?? originalCode;
  });
  const [fontSize, setFontSize] = useState<CodeFontSize>(() => loadCodeFontSize(storage));
  const [wrap, setWrap] = useState(() => loadCodeWrap(storage) ?? prefersWrapByDefault());
  const [items, setItems] = useState<GoRunEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<GoLoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const formattingRef = useRef(false);
  const mountedRef = useRef(true);
  const codeRef = useRef(code);
  const editorRef = useRef<CodeEditorHandle>(null);
  const draftContextRef = useRef({ storage, storageKey, codeHash, originalCode });

  useEffect(() => {
    draftContextRef.current = { storage, storageKey, codeHash, originalCode };
  }, [storage, storageKey, codeHash, originalCode]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => engineRef.current.preload())
      .then(
        () => {
          if (cancelled || !mountedRef.current) return;
          setLoadState('ready');
        },
        (error: unknown) => {
          if (cancelled || !mountedRef.current) return;
          setLoadState('error');
          setLoadError(describeError(error));
        },
      );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (storage === null) return () => {};
    if (code === originalCode) {
      clearDraft(storage, storageKey);
      return () => {};
    }
    const timer = window.setTimeout(() => {
      saveDraft(storage, storageKey, { codeHash, code });
    }, DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [code, originalCode, storage, storageKey, codeHash]);

  // 入力直後に画面を離れても最後の編集を落とさない。unmount に加えて、
  // モバイルで発火しやすい pagehide と、タブが隠れたときにも保存する。
  useEffect(() => {
    const flushDraft = () => {
      const context = draftContextRef.current;
      if (context.storage === null) return;
      const latest = codeRef.current;
      if (latest === context.originalCode) {
        clearDraft(context.storage, context.storageKey);
      } else {
        saveDraft(context.storage, context.storageKey, {
          codeHash: context.codeHash,
          code: latest,
        });
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushDraft();
    };
    window.addEventListener('pagehide', flushDraft);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushDraft);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushDraft();
    };
  }, []);

  const isDirty = code !== originalCode;

  const updateCode = (next: string) => {
    codeRef.current = next;
    setCode(next);
    setFormatError(null);
  };

  const handleRun = async () => {
    if (runningRef.current || formattingRef.current || loadState === 'loading') return;
    runningRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setItems([]);

    let result: GoRunResult;
    try {
      result = await engineRef.current.run(codeRef.current, {
        timeoutMs,
        signal: controller.signal,
        onEvent: (event) => {
          if (!mountedRef.current) return;
          setItems((previous) => appendRunEvent(previous, event));
          if (event.type === 'exit') {
            runningRef.current = false;
            setIsRunning(false);
          }
        },
      });
    } catch (error) {
      result = { status: 'crashed', error: describeError(error), ms: 0 };
      if (mountedRef.current) {
        setItems((previous) =>
          appendRunEvent(previous, {
            type: 'exit',
            ok: false,
            error: result.error,
            ms: result.ms,
          }),
        );
      }
    }

    if (!mountedRef.current) return;
    if (abortRef.current === controller) {
      abortRef.current = null;
      runningRef.current = false;
      setIsRunning(false);
    }
    if (result.status !== 'crashed') {
      setLoadState('ready');
      setLoadError(null);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  /**
   * gofmt で整形してエディタを置き換える。構文エラーのときはエディタに触らず、
   * go/parser が返した `行:列: 内容` をそのまま控えめに出す。
   */
  const handleFormat = async () => {
    if (runningRef.current || formattingRef.current || loadState === 'loading') return;
    formattingRef.current = true;
    setIsFormatting(true);
    setFormatError(null);

    let result: GoFormatResult;
    try {
      result = await engineRef.current.format(codeRef.current);
    } catch (error) {
      result = { status: 'crashed', error: describeError(error) };
    }

    formattingRef.current = false;
    if (!mountedRef.current) return;
    setIsFormatting(false);
    if (result.status === 'ok' && result.code !== undefined) {
      // エディタの transaction として置き換える（undo 可能・カーソルはできるだけ保持）
      if (editorRef.current !== null) {
        editorRef.current.replaceDoc(result.code);
      } else {
        updateCode(result.code);
      }
      return;
    }
    if (result.status !== 'busy') {
      setFormatError(result.error ?? 'フォーマットできませんでした');
    }
  };

  // 最新の handleRun を参照するための入れ物（後述の document レベルのショートカット用）。
  const handleRunRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    handleRunRef.current = handleRun;
  });

  /**
   * エディタの外（レッスン画面のどこか）にフォーカスがあるときの Shift + Enter。
   * 入力欄・ボタン・リンク・ダイアログの操作とは衝突させない。
   * 表示設定や目次は `<dialog>`（`role` 属性なし）なので、`dialog[open]` で見る。
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key !== 'Enter' || !event.shiftKey) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, button, a, [contenteditable="true"], .cm-editor, [role="dialog"], dialog[open]',
        ) !== null
      ) {
        return;
      }
      if (runningRef.current) return;
      event.preventDefault();
      void handleRunRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleReset = () => {
    if (!isDirty || isRunning) return;
    if (!window.confirm(DEFAULT_CONFIRM_MESSAGE)) return;
    updateCode(originalCode);
    setItems([]);
    if (storage !== null) clearDraft(storage, storageKey);
  };

  const handleFontSize = (size: CodeFontSize) => {
    setFontSize(size);
    saveCodeFontSize(storage, size);
  };

  const handleWrap = () => {
    const next = !wrap;
    setWrap(next);
    saveCodeWrap(storage, next);
  };

  return (
    <section
      aria-label={`${fileName} のコード例`}
      data-font-size={fontSize}
      data-layout={layout}
      className={cn('code-runner flex flex-col gap-3', isFilled && 'h-full min-h-0', className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <FileCode2 className="size-4 shrink-0" aria-hidden />
          <span className="truncate font-mono" title={fileName}>
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1" role="group" aria-label="文字サイズ">
            {CODE_FONT_SIZE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={fontSize === option.value ? 'secondary' : 'ghost'}
                aria-pressed={fontSize === option.value}
                aria-label={`文字サイズ ${option.label}`}
                className="min-h-11 min-w-11"
                onClick={() => handleFontSize(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant={wrap ? 'secondary' : 'ghost'}
            aria-pressed={wrap}
            aria-label="折り返し"
            title="折り返し"
            className="min-h-11 min-w-11"
            onClick={handleWrap}
          >
            <WrapText aria-hidden />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-lg border border-border bg-card shadow-sm',
          isFilled && 'min-h-0 flex-1',
        )}
      >
        <CodeEditor
          ref={editorRef}
          value={code}
          fileName={fileName}
          fontSize={fontSize}
          lineWrapping={wrap}
          onChange={updateCode}
          onRun={() => void handleRunRef.current()}
          onFormat={() => void handleFormat()}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isRunning ? (
          <Button
            type="button"
            variant="destructive"
            onClick={handleStop}
            className="min-h-11 px-4"
          >
            <Square aria-hidden />
            停止
          </Button>
        ) : (
          <Button
            type="button"
            onClick={() => void handleRunRef.current()}
            disabled={loadState === 'loading' || isFormatting}
            aria-keyshortcuts="Shift+Enter"
            title="実行（Shift + Enter）"
            className="min-h-11 px-4"
          >
            <Play aria-hidden />
            実行
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleFormat()}
          disabled={isRunning || isFormatting || loadState === 'loading'}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          title="フォーマット（Ctrl + Enter / Cmd + Enter）"
          className="min-h-11 px-4"
        >
          <AlignLeft aria-hidden />
          フォーマット
        </Button>
        {isDirty ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isRunning}
            className="min-h-11 px-3"
          >
            <RotateCcw aria-hidden />
            元に戻す
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          'flex flex-col gap-3',
          // 高さを固定した右カラムでは、出力と既知の差異をまとめて内部スクロールさせる。
          // 出力が短いときはエディタに高さを譲り、長いときは 45% までで頭打ちにする。
          isFilled && 'max-h-[45%] min-h-0 shrink-0 overflow-y-auto overscroll-contain',
        )}
      >
        {formatError === null ? null : (
          <p role="status" className="text-xs leading-5 text-destructive">
            フォーマットできませんでした: {formatError}
          </p>
        )}

        <RunOutput
          items={items}
          isRunning={isRunning}
          loadState={loadState}
          loadError={loadError}
        />

        <details className="group shrink-0 rounded-lg border border-border bg-muted/20 px-3 text-xs">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-medium [&::-webkit-details-marker]:hidden">
            既知の差異
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <ul className="mt-1 mb-3 list-disc space-y-1 pl-4 leading-5 text-muted-foreground">
            <li>時刻は実時間です（go.dev は 2009-11-10 23:00 UTC に固定されています）。</li>
            <li>
              <code>runtime.GOOS</code> は <code>js</code> になります。
            </li>
            <li>
              <code>%T</code> の型名が gc と異なる場合があります。
            </li>
            <li>不正なコード（return の欠落など）を受理する場合があります。</li>
          </ul>
        </details>
      </div>
    </section>
  );
}
