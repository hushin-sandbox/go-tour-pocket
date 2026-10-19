import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn, isStoragePersisted } from '@/react-app/shared/lib';
import {
  DEFAULT_GO_TIMEOUT_MS,
  preloadGo,
  runGo,
  type GoRunEvent,
  type GoRunResult,
} from '@/react-app/shared/lib';
import { Button } from '@/react-app/shared/ui';
import { defaultPreset, goPresets } from './presets';

type OutputItem = GoRunEvent;

function isTextEvent(
  event: OutputItem,
): event is Extract<OutputItem, { type: 'stdout' | 'stderr' }> {
  return event.type === 'stdout' || event.type === 'stderr';
}

function ServiceWorkerState() {
  const [state, setState] = useState('確認中…');

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      if (!('serviceWorker' in navigator)) {
        if (!cancelled) setState('非対応');
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (cancelled) return;
      if (registration === undefined) {
        setState('未登録');
        return;
      }
      const phase = registration.waiting
        ? 'waiting'
        : registration.installing
          ? 'installing'
          : registration.active
            ? 'active'
            : 'none';
      setState(
        `${phase}${navigator.serviceWorker.controller === null ? ' / 未制御' : ' / 制御中'}`,
      );
    };
    void update();
    const timer = setInterval(() => void update(), 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return <>{state}</>;
}

function OnlineState() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  return <>{online ? 'オンライン' : 'オフライン'}</>;
}

function EnvironmentList() {
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isStoragePersisted().then((value) => {
      if (!cancelled) setPersisted(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: [string, ReactNode][] = [
    [
      'User-Agent',
      <span key="ua" className="break-all">
        {navigator.userAgent}
      </span>,
    ],
    ['Service Worker', <ServiceWorkerState key="sw" />],
    ['storage.persisted()', persisted === null ? '確認中…' : String(persisted)],
    ['ネットワーク', <OnlineState key="online" />],
  ];

  return (
    <dl className="divide-y divide-border border-t border-border" data-testid="environment">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-6"
        >
          <dt className="shrink-0 text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="min-w-0 text-xs leading-5 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SpikePage() {
  const [presetId, setPresetId] = useState(defaultPreset.id);
  const [code, setCode] = useState(defaultPreset.code);
  const [items, setItems] = useState<OutputItem[]>([]);
  const [running, setRunning] = useState(false);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [firstRunMs, setFirstRunMs] = useState<number | null>(null);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void preloadGo()
      .then((result) => {
        if (!cancelled) setLoadMs(result.loadMs);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleRun = async () => {
    if (running) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setItems([]);
    let result: GoRunResult;
    try {
      result = await runGo(code, {
        timeoutMs: DEFAULT_GO_TIMEOUT_MS,
        signal: controller.signal,
        onEvent: (event) => setItems((previous) => [...previous, event]),
      });
    } catch (error: unknown) {
      result = {
        status: 'crashed',
        error: error instanceof Error ? error.message : String(error),
        ms: 0,
      };
      setItems((previous) => [
        ...previous,
        { type: 'exit', ok: false, error: result.error, ms: result.ms },
      ]);
    }
    setRunning(false);
    setLastRunMs(result.ms);
    setFirstRunMs((previous) => previous ?? result.ms);
    abortRef.current = null;
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handlePreset = (id: string, presetCode: string) => {
    setPresetId(id);
    setCode(presetCode);
  };

  const metrics: [string, string][] = [
    ['wasm ロード', loadError ?? (loadMs === null ? '読み込み中…' : `${loadMs} ms`)],
    ['初回実行', firstRunMs === null ? '－' : `${firstRunMs} ms`],
    ['直近の実行', lastRunMs === null ? '－' : `${lastRunMs} ms`],
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">実行エンジン スパイク</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Yaegi を wasm 化した Go インタプリタを Web Worker
          で動かし、オフラインでどこまで動くかを確認する 検証ページです。本番 UI ではありません。
        </p>
      </header>

      <section className="flex flex-col gap-3" aria-label="プリセット">
        <h2 className="text-sm font-medium">プリセット</h2>
        <div className="-mx-1 flex flex-wrap gap-2 px-1">
          {goPresets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant={presetId === preset.id ? 'default' : 'outline'}
              onClick={() => handlePreset(preset.id, preset.code)}
              disabled={running}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {goPresets.find((preset) => preset.id === presetId)?.description}
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-label="コード">
        <label className="text-sm font-medium" htmlFor="go-code">
          Go のコード
        </label>
        <textarea
          id="go-code"
          data-testid="go-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          spellCheck={false}
          rows={16}
          className="w-full resize-y rounded-lg border border-border bg-card p-3 font-mono text-xs leading-5 shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => void handleRun()}
            disabled={running}
            className="min-w-24"
          >
            実行
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleStop}
            disabled={!running}
            className="min-w-24"
          >
            停止
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-label="出力">
        <h2 className="text-sm font-medium">出力</h2>
        <div
          data-testid="go-output"
          className="flex min-h-32 flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm"
        >
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">まだ実行していません。</p>
          ) : (
            items.map((item, index) => {
              if (isTextEvent(item)) {
                return (
                  <pre
                    // 出力は順に追記されるだけで並べ替えない
                    key={index}
                    className={cn(
                      'whitespace-pre-wrap font-mono text-xs leading-5',
                      item.type === 'stderr' && 'text-destructive',
                    )}
                  >
                    {item.data}
                  </pre>
                );
              }
              if (item.type === 'image') {
                return (
                  <img
                    key={index}
                    data-testid="go-image"
                    src={item.dataUrl}
                    alt="Go プログラムが生成した画像"
                    className="w-full max-w-64 rounded border border-border"
                  />
                );
              }
              return (
                <p
                  key={index}
                  data-testid="run-status"
                  className={cn('text-xs', item.ok ? 'text-muted-foreground' : 'text-destructive')}
                >
                  {item.ok ? `終了（${item.ms} ms）` : `エラー: ${item.error ?? '不明なエラー'}`}
                </p>
              );
            })
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-label="計測">
        <h2 className="text-sm font-medium">計測</h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="metrics">
          {metrics.map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm"
            >
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-mono text-sm tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col gap-3" aria-label="環境">
        <h2 className="text-sm font-medium">環境</h2>
        <EnvironmentList />
      </section>
    </div>
  );
}
