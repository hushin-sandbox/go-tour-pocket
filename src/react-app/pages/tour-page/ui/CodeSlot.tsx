/**
 * コード実行 UI（CodeRunner）の差し込み口。
 *
 * CodeRunner 担当はこのコンポーネントを差し替える。呼び出し側は次の props を渡す:
 * - `code`: 原文コード（`.play` の内容）
 * - `storageKey`: `"<lesson>/<pageIndex>"`（0 始まり）。編集コード保存のキー
 * - `codeHash`: 原文コードの hash。原文が変わったら保存済みの編集内容を捨てるためのキー
 *
 * いまは原文コードをそのまま読める形で表示するだけ。
 */
export type CodeSlotProps = {
  code: string;
  storageKey: string;
  codeHash: string;
};

export function CodeSlot({ code, storageKey, codeHash }: CodeSlotProps) {
  return (
    <section
      aria-labelledby="code-slot-heading"
      data-code-slot=""
      data-storage-key={storageKey}
      data-code-hash={codeHash}
      className="flex flex-col gap-2 border-t border-border pt-6"
    >
      <h2 id="code-slot-heading" className="text-sm font-medium text-muted-foreground">
        コード
      </h2>
      <pre
        tabIndex={0}
        className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-[0.85em] leading-relaxed"
      >
        <code>{code}</code>
      </pre>
      <p className="text-xs leading-5 text-muted-foreground">
        コードの編集と実行は準備中です。いまは原文を表示しています。
      </p>
    </section>
  );
}
