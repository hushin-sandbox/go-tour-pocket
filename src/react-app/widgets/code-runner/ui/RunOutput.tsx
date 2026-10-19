import { CheckCircle2, CircleAlert, CircleStop, LoaderCircle, Timer } from 'lucide-react';
import { cn, type GoRunEvent } from '@/react-app/shared/lib';
import { groupRunOutput, type RunOutputBlock } from '../lib/runOutput';

export type GoLoadState = 'loading' | 'ready' | 'error';

export interface RunOutputProps {
  items: GoRunEvent[];
  isRunning: boolean;
  loadState: GoLoadState;
  loadError: string | null;
}

export function RunOutput({ items, isRunning, loadState, loadError }: RunOutputProps) {
  const blocks = groupRunOutput(items);
  const isEmpty = blocks.length === 0;

  return (
    <div
      role="log"
      aria-label="実行結果"
      aria-live="polite"
      aria-busy={isRunning}
      className="flex min-h-24 flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3"
    >
      {loadState === 'loading' ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          Go を準備中…
        </p>
      ) : null}

      {loadState === 'error' ? (
        <p className="text-xs leading-5 text-destructive">
          Go を準備できませんでした
          {loadError === null ? '' : `: ${loadError}`}
        </p>
      ) : null}

      {isEmpty && !isRunning && loadState === 'ready' ? (
        <p className="text-xs text-muted-foreground">まだ実行していません。</p>
      ) : null}

      {blocks.map((block, index) => {
        if (block.type === 'text') {
          return (
            <pre
              // 出力は追記されるだけで並べ替えない
              key={index}
              className="font-mono text-xs leading-5 break-words whitespace-pre-wrap"
            >
              {block.chunks.map((chunk, chunkIndex) => (
                <span
                  key={chunkIndex}
                  className={cn(chunk.type === 'stderr' && 'text-destructive')}
                >
                  {chunk.data}
                </span>
              ))}
            </pre>
          );
        }
        if (block.type === 'image') {
          return (
            <img
              key={index}
              src={block.dataUrl}
              alt="Go プログラムが出力した画像"
              className="max-w-full rounded border border-border sm:max-w-80"
            />
          );
        }
        return <ExitMessage key={index} block={block} />;
      })}

      {isRunning ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          実行中…
        </p>
      ) : null}
    </div>
  );
}

function ExitMessage({ block }: { block: Extract<RunOutputBlock, { type: 'exit' }> }) {
  const stopped = block.status === 'cancelled';
  const timedOut = block.status === 'timeout';
  const failed = !block.ok && !stopped && !timedOut;

  return (
    <p
      className={cn(
        'flex items-start gap-2 text-xs leading-5',
        failed ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      {block.ok ? (
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      ) : stopped ? (
        <CircleStop className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      ) : timedOut ? (
        <Timer className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      ) : (
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      )}
      <span>
        {block.ok
          ? '終了'
          : stopped
            ? '停止しました'
            : timedOut
              ? 'タイムアウトしました'
              : `エラー: ${block.error ?? '不明なエラー'}`}
        （{block.ms} ms）
      </span>
    </p>
  );
}
