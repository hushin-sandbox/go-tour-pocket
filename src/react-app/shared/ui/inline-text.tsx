import type { ReactNode } from 'react';
import type { InlineToken } from '@/shared/inline';

type InlineTextProps = {
  tokens: InlineToken[];
};

/**
 * `parseInline` のトークン列を描画する。英日どちらの本文にも同じものを使う。
 *
 * - `javascript:` のリンクは Tour の旧 UI 向けの操作なので、リンクにせず強調表示だけにする
 * - `/` 始まりのリンクは go.dev 上の Tour 内リンクなので go.dev に解決する
 */
export function InlineText({ tokens }: InlineTextProps) {
  return <>{tokens.map((token, index) => renderToken(token, index))}</>;
}

function renderToken(token: InlineToken, key: number): ReactNode {
  switch (token.type) {
    case 'text':
      return token.value;
    case 'code':
      return (
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] text-foreground [overflow-wrap:anywhere]"
        >
          {token.value}
        </code>
      );
    case 'em':
      return <em key={key}>{token.value}</em>;
    case 'strong':
      return <strong key={key}>{token.value}</strong>;
    case 'link': {
      const href = linkHref(token.url);
      const label = renderTokens(token.label);
      if (href === undefined) {
        return (
          <span key={key} className="underline decoration-dotted underline-offset-4">
            {label}
          </span>
        );
      }
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary underline decoration-primary/50 underline-offset-4 hover:decoration-primary"
        >
          {label}
        </a>
      );
    }
    default:
      return null;
  }
}

function renderTokens(tokens: InlineToken[]): ReactNode[] {
  return tokens.map((token, index) => renderToken(token, index));
}

function linkHref(url: string): string | undefined {
  if (url.startsWith('javascript:') || url.startsWith('#')) return undefined;
  if (url.startsWith('/')) return `https://go.dev${url}`;
  return url;
}
