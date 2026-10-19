import { useState } from 'react';
import type { JoinedBlock, JoinedPage } from '@/react-app/entities/lesson';
import type { DisplayMode } from '@/react-app/features/display-mode';
import { parseInline } from '@/shared/inline';
import { InlineText } from '@/react-app/shared/ui';

type PageBlocksProps = {
  page: JoinedPage;
  mode: DisplayMode;
};

export function PageBlocks({ page, mode }: PageBlocksProps) {
  return (
    <div className="flex flex-col gap-7">
      {page.blocks.map((block) => (
        <BlockView key={block.id} block={block} mode={mode} />
      ))}
    </div>
  );
}

function BlockView({ block, mode }: { block: JoinedBlock; mode: DisplayMode }) {
  switch (block.kind) {
    case 'p':
      return <ParagraphBlock block={block} mode={mode} />;
    case 'list':
      return <ListBlock block={block} mode={mode} />;
    case 'pre':
      return (
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-[0.85em] leading-relaxed">
          <code>{block.text}</code>
        </pre>
      );
    case 'image':
      return (
        <figure className="flex justify-center">
          <img
            src={block.src}
            alt="Go ツアーの図"
            loading="lazy"
            className="h-auto max-w-full rounded-lg border border-border"
          />
        </figure>
      );
    default:
      return null;
  }
}

const bodyTextClass = 'leading-[1.9] text-pretty';
const translationClass =
  'border-l-2 border-primary/40 pl-3 leading-[1.9] text-muted-foreground text-pretty';

function ParagraphBlock({
  block,
  mode,
}: {
  block: Extract<JoinedBlock, { kind: 'p' }>;
  mode: DisplayMode;
}) {
  const [expanded, setExpanded] = useState(false);
  const translation = block.ja;

  if (mode === 'bilingual') {
    return (
      <div className="flex flex-col gap-2">
        <p className={bodyTextClass}>
          <InlineText tokens={parseInline(block.en)} />
        </p>
        {translation && (
          <p className={translationClass}>
            <InlineText tokens={parseInline(translation)} />
          </p>
        )}
      </div>
    );
  }

  if (mode === 'ja') {
    return (
      <p className={bodyTextClass}>
        <InlineText tokens={parseInline(translation ?? block.en)} />
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        onClick={(event) => {
          if (!translation) return;
          if (event.target instanceof Element && event.target.closest('a')) return;
          setExpanded((previous) => !previous);
        }}
        className={translation ? 'cursor-pointer' : undefined}
      >
        <p className={bodyTextClass}>
          <InlineText tokens={parseInline(block.en)} />
        </p>
        {translation && expanded && (
          <p className={`${translationClass} mt-2`}>
            <InlineText tokens={parseInline(translation)} />
          </p>
        )}
      </div>
      {translation && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((previous) => !previous);
          }}
          className="min-h-11 text-xs font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          {expanded ? '訳を閉じる' : '訳を表示'}
        </button>
      )}
    </div>
  );
}

function ListBlock({
  block,
  mode,
}: {
  block: Extract<JoinedBlock, { kind: 'list' }>;
  mode: DisplayMode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasTranslation = block.items.some((item) => item.ja !== undefined);

  const englishItems = block.items.map((item) => item.en);
  const translatedItems = block.items.map((item) => item.ja ?? item.en);

  if (mode === 'bilingual') {
    return (
      <div className="flex flex-col gap-2">
        <ul className="list-disc space-y-1 pl-5">
          {englishItems.map((item, index) => (
            <li key={index} className={bodyTextClass}>
              <InlineText tokens={parseInline(item)} />
            </li>
          ))}
        </ul>
        {hasTranslation && (
          <div className={translationClass}>
            <ul className="list-disc space-y-1 pl-4">
              {translatedItems.map((item, index) => (
                <li key={index}>
                  <InlineText tokens={parseInline(item)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'ja') {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {translatedItems.map((item, index) => (
          <li key={index} className={bodyTextClass}>
            <InlineText tokens={parseInline(item)} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        onClick={(event) => {
          if (!hasTranslation) return;
          if (event.target instanceof Element && event.target.closest('a')) return;
          setExpanded((previous) => !previous);
        }}
        className={hasTranslation ? 'w-full cursor-pointer' : 'w-full'}
      >
        <ul className="list-disc space-y-1 pl-5">
          {englishItems.map((item, index) => (
            <li key={index} className={bodyTextClass}>
              <InlineText tokens={parseInline(item)} />
            </li>
          ))}
        </ul>
        {hasTranslation && expanded && (
          <div className={`${translationClass} mt-2`}>
            <ul className="list-disc space-y-1 pl-4">
              {translatedItems.map((item, index) => (
                <li key={index}>
                  <InlineText tokens={parseInline(item)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {hasTranslation && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((previous) => !previous);
          }}
          className="min-h-11 text-xs font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          {expanded ? '訳を閉じる' : '訳を表示'}
        </button>
      )}
    </div>
  );
}
