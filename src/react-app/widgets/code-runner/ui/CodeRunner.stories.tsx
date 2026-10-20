import type { Meta, StoryObj } from '@storybook/tanstack-react';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { expect, waitFor, within } from 'storybook/test';
import { draftStorageKey, saveDraft } from '../lib/storage';
import { CodeRunner } from './CodeRunner';
import {
  CODE_HASH,
  EDITED_CODE,
  FIXED_CODE,
  FORMAT_ERROR,
  FORMATTED_CODE,
  LOOP_CODE,
  PATTERNS,
  SAMPLE_CODE,
  STORAGE_KEY,
  createMockEngine,
  createPreparingEngine,
  createStopEngine,
} from './CodeRunner.mock';

/** CodeMirror の本文を行単位で取り出す（textContent は改行を保たないため）。 */
const readEditorLines = (editor: HTMLElement): string[] =>
  Array.from(editor.querySelectorAll('.cm-line'), (line) => line.textContent ?? '');

/** 確認ダイアログの呼び出しを記録する。story ごとに beforeEach でリセットする。 */
let confirmMessages: string[] = [];
let confirmResult = true;

const meta = {
  component: CodeRunner,
  args: {
    code: SAMPLE_CODE,
    fileName: 'packages.go',
    storageKey: STORAGE_KEY,
    codeHash: CODE_HASH,
    engine: createMockEngine(),
  },
  beforeEach: () => {
    window.localStorage.clear();
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    return () => {
      window.confirm = originalConfirm;
      window.localStorage.clear();
    };
  },
} satisfies Meta<typeof CodeRunner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RunsCode: Story = {
  name: '実行して出力を表示',
  args: {
    engine: createMockEngine({
      events: [{ type: 'stdout', data: 'Hello, 世界\n' }],
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '実行' }));

    const output = await canvas.findByRole('log');
    await expect(await within(output).findByText(/Hello, 世界/)).toBeVisible();
    await expect(await within(output).findByText('終了（7 ms）')).toBeVisible();
  },
};

export const StderrAndError: Story = {
  name: 'stderr とエラー終了',
  args: {
    engine: createMockEngine({
      events: [{ type: 'stderr', data: 'panic: boom\n' }],
      result: { status: 'error', error: 'exit status 1', ms: 3 },
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '実行' }));

    const output = await canvas.findByRole('log');
    await expect(await within(output).findByText(/panic: boom/)).toBeVisible();
    await expect(await within(output).findByText('エラー: exit status 1（3 ms）')).toBeVisible();
  },
};

export const ImageOutput: Story = {
  name: '画像を表示',
  args: {
    engine: createMockEngine({
      events: [
        {
          type: 'image',
          dataUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nK0AAAAASUVORK5CYII=',
        },
      ],
    }),
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '実行' }));

    const output = await canvas.findByRole('log');
    await expect(await within(output).findByAltText('Go プログラムが出力した画像')).toBeVisible();
  },
};

export const Stop: Story = {
  name: '停止',
  args: { engine: createStopEngine() },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '実行' }));

    await expect(await canvas.findByRole('button', { name: '停止' })).toBeVisible();
    const output = await canvas.findByRole('log');
    await expect(await within(output).findByText(/running/)).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: '停止' }));

    await expect(await within(output).findByText('停止しました（12 ms）')).toBeVisible();
    await expect(await canvas.findByRole('button', { name: '実行' })).toBeEnabled();
  },
};

export const DraftRestored: Story = {
  name: '保存した編集を復元',
  beforeEach: () => {
    saveDraft(window.localStorage, STORAGE_KEY, {
      codeHash: CODE_HASH,
      code: EDITED_CODE,
    });
  },
  play: async ({ canvas }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    await waitFor(() => expect(editor).toHaveTextContent('fmt.Println("edited")'));
    await expect(await canvas.findByRole('button', { name: '元に戻す' })).toBeVisible();
  },
};

export const DraftSavedOnPageHide: Story = {
  name: 'pagehide で下書きを保存',
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    await userEvent.click(editor);
    await userEvent.type(editor, 'x');

    // debounce の 400ms を待たず、画面を離れる合図で保存される
    window.dispatchEvent(new Event('pagehide'));

    await waitFor(() =>
      expect(window.localStorage.getItem(draftStorageKey(STORAGE_KEY))).toContain('x'),
    );
  },
};

export const DraftDiscardedWhenHashChanges: Story = {
  name: '原文が変わったら下書きを破棄',
  beforeEach: () => {
    saveDraft(window.localStorage, STORAGE_KEY, {
      codeHash: 'old-code-hash',
      code: EDITED_CODE,
    });
  },
  play: async ({ canvas }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    await waitFor(() => expect(editor).toHaveTextContent('fmt.Println("Hello, 世界")'));
    await expect(window.localStorage.getItem(draftStorageKey(STORAGE_KEY))).toBeNull();
    await expect(canvas.queryByRole('button', { name: '元に戻す' })).not.toBeInTheDocument();
  },
};

export const ResetDraft: Story = {
  name: '確認して元に戻す',
  beforeEach: () => {
    saveDraft(window.localStorage, STORAGE_KEY, {
      codeHash: CODE_HASH,
      code: EDITED_CODE,
    });
  },
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    await waitFor(() => expect(editor).toHaveTextContent('fmt.Println("edited")'));

    await userEvent.click(await canvas.findByRole('button', { name: '元に戻す' }));

    await waitFor(() => expect(editor).toHaveTextContent('fmt.Println("Hello, 世界")'));
    await waitFor(() =>
      expect(canvas.queryByRole('button', { name: '元に戻す' })).not.toBeInTheDocument(),
    );
    await expect(window.localStorage.getItem(draftStorageKey(STORAGE_KEY))).toBeNull();
  },
};

export const PatternsSwitch: Story = {
  name: 'コードのパターンを切り替える',
  args: { patterns: PATTERNS },
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    const group = await canvas.findByRole('group', { name: 'コードのパターン' });
    const originalChip = within(group).getByRole('button', { name: '原文' });
    const fixedChip = within(group).getByRole('button', { name: '修正する' });
    const loopChip = within(group).getByRole('button', { name: 'ループする' });

    // 原文のコードと一致しているので「原文」が選択中
    await expect(originalChip).toHaveAttribute('aria-pressed', 'true');
    await expect(fixedChip).toHaveAttribute('aria-pressed', 'false');
    await expect(await canvas.findByText('このまま実行するとエラーになります。')).toBeVisible();

    // 実行結果を出しておき、切り替えたら消えることを確かめる
    await userEvent.click(await canvas.findByRole('button', { name: '実行' }));
    const output = await canvas.findByRole('log');
    await expect(await within(output).findByText('終了（7 ms）')).toBeVisible();

    await userEvent.click(fixedChip);

    await waitFor(() => expect(readEditorLines(editor)).toEqual(FIXED_CODE.split('\n')));
    await expect(fixedChip).toHaveAttribute('aria-pressed', 'true');
    await expect(originalChip).toHaveAttribute('aria-pressed', 'false');
    await expect(await canvas.findByText('修正すると動きます。')).toBeVisible();
    await expect(within(output).getByText('まだ実行していません。')).toBeVisible();

    // note を持たないパターンでは注記を出さない
    await userEvent.click(loopChip);
    await waitFor(() => expect(readEditorLines(editor)).toEqual(LOOP_CODE.split('\n')));
    await expect(loopChip).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.queryByText('修正すると動きます。')).not.toBeInTheDocument();

    // パターン選択中は確認なしで原文に戻せる
    await expect(canvas.queryByRole('button', { name: '元に戻す' })).toBeVisible();
    await userEvent.click(await canvas.findByRole('button', { name: '元に戻す' }));
    await waitFor(() => expect(readEditorLines(editor)).toEqual(SAMPLE_CODE.split('\n')));
    await expect(originalChip).toHaveAttribute('aria-pressed', 'true');
    await expect(await canvas.findByText('このまま実行するとエラーになります。')).toBeVisible();
  },
};

export const PatternsConfirmWhenEdited: Story = {
  name: '手で編集した後は確認してから切り替える',
  args: { patterns: PATTERNS },
  beforeEach: () => {
    confirmMessages = [];
    confirmResult = false;
    window.confirm = (message?: string) => {
      confirmMessages.push(message ?? '');
      return confirmResult;
    };
  },
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    const group = await canvas.findByRole('group', { name: 'コードのパターン' });
    const fixedChip = within(group).getByRole('button', { name: '修正する' });

    // 手で編集すると、どのパターンとも一致しないのでどれも pressed でない
    await userEvent.click(editor);
    await userEvent.type(editor, 'x');
    await waitFor(() => expect(editor).toHaveTextContent('x'));
    await expect(fixedChip).toHaveAttribute('aria-pressed', 'false');

    // キャンセルしたら編集したコードが残る
    await userEvent.click(fixedChip);
    await expect(confirmMessages).toEqual([
      '編集したコードを破棄して「修正する」に切り替えますか？',
    ]);
    await expect(editor).toHaveTextContent('fmt.Println("Hello, 世界")');
    await expect(editor).not.toHaveTextContent('fmt.Println("fixed")');

    // OK ならパターンに置き換わる
    confirmResult = true;
    await userEvent.click(fixedChip);
    await expect(confirmMessages).toHaveLength(2);
    await waitFor(() => expect(readEditorLines(editor)).toEqual(FIXED_CODE.split('\n')));
    await expect(fixedChip).toHaveAttribute('aria-pressed', 'true');
  },
};

export const PatternsDraftRestored: Story = {
  name: '下書きがパターンと一致すればそのチップが選択される',
  args: { patterns: PATTERNS },
  beforeEach: () => {
    saveDraft(window.localStorage, STORAGE_KEY, {
      codeHash: CODE_HASH,
      code: FIXED_CODE,
    });
  },
  play: async ({ canvas }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    await waitFor(() => expect(editor).toHaveTextContent('fmt.Println("fixed")'));

    const group = await canvas.findByRole('group', { name: 'コードのパターン' });
    await expect(within(group).getByRole('button', { name: '修正する' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(within(group).getByRole('button', { name: '原文' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(await canvas.findByText('修正すると動きます。')).toBeVisible();
  },
};

export const PatternsResetFromVariant: Story = {
  name: 'パターン選択中の元に戻すは確認しない',
  args: { patterns: PATTERNS },
  beforeEach: () => {
    confirmMessages = [];
    window.confirm = (message?: string) => {
      confirmMessages.push(message ?? '');
      return true;
    };
  },
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    const group = await canvas.findByRole('group', { name: 'コードのパターン' });
    await userEvent.click(within(group).getByRole('button', { name: '修正する' }));
    await waitFor(() => expect(readEditorLines(editor)).toEqual(FIXED_CODE.split('\n')));

    await userEvent.click(await canvas.findByRole('button', { name: '元に戻す' }));

    await waitFor(() => expect(readEditorLines(editor)).toEqual(SAMPLE_CODE.split('\n')));
    await expect(confirmMessages).toEqual([]);
    await expect(within(group).getByRole('button', { name: '原文' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
};

export const NoPatterns: Story = {
  name: 'パターンが無ければチップを出さない',
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('textbox', { name: /packages.go のコード/ }),
    ).toBeVisible();
    await expect(canvas.queryByRole('group', { name: 'コードのパターン' })).not.toBeInTheDocument();
  },
};

export const PatternsFillLayout: Story = {
  name: 'fill レイアウトでもチップと注記が見える',
  args: { patterns: PATTERNS, layout: 'fill' },
  decorators: [
    (Story) => (
      <div className="h-[480px] w-[375px] max-w-full">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('group', { name: 'コードのパターン' })).toBeVisible();
    await expect(await canvas.findByText('このまま実行するとエラーになります。')).toBeVisible();
    await expect(
      await canvas.findByRole('textbox', { name: /packages.go のコード/ }),
    ).toBeVisible();
  },
};

export const Preparing: Story = {
  name: 'wasm を準備中',
  args: { engine: createPreparingEngine() },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Go を準備中…')).toBeVisible();
    await expect(canvas.getByRole('button', { name: '実行' })).toBeDisabled();
  },
};

export const DarkMode: Story = {
  name: 'ダークモード',
  decorators: [
    (Story) => (
      <div className="dark bg-background p-4 text-foreground">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('textbox', { name: /packages.go のコード/ }),
    ).toBeVisible();
  },
};

export const ChangeFontSize: Story = {
  name: '文字サイズを保存',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: '文字サイズ 大' }));

    await expect(canvas.getByRole('button', { name: '文字サイズ 大' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(window.localStorage.getItem('go-tour-pocket:code-font-size')).toBe('lg');
  },
};

export const ToggleLineWrapping: Story = {
  name: '折り返しを切り替えて保存',
  beforeEach: () => {
    // ビューポート幅の既定値に左右されないよう、オフを保存してから描画する
    window.localStorage.setItem('go-tour-pocket:code-wrap', 'off');
  },
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    const button = await canvas.findByRole('button', { name: '折り返し' });
    await expect(button).toHaveAttribute('title', '折り返し');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(editor).not.toHaveClass('cm-lineWrapping');

    await userEvent.click(button);

    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(editor).toHaveClass('cm-lineWrapping');
    await expect(window.localStorage.getItem('go-tour-pocket:code-wrap')).toBe('on');

    await userEvent.click(button);

    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(editor).not.toHaveClass('cm-lineWrapping');
    await expect(window.localStorage.getItem('go-tour-pocket:code-wrap')).toBe('off');
  },
};

export const LineWrappingStoredOn: Story = {
  name: '保存した折り返し（オン）で開く',
  beforeEach: () => {
    window.localStorage.setItem('go-tour-pocket:code-wrap', 'on');
  },
  play: async ({ canvas }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    await expect(await canvas.findByRole('button', { name: '折り返し' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(editor).toHaveClass('cm-lineWrapping');
  },
};

export const LineWrappingStoredOff: Story = {
  name: '保存した折り返し（オフ）で開く',
  beforeEach: () => {
    window.localStorage.setItem('go-tour-pocket:code-wrap', 'off');
  },
  play: async ({ canvas }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    await expect(await canvas.findByRole('button', { name: '折り返し' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(editor).not.toHaveClass('cm-lineWrapping');
  },
};

export const FormatCode: Story = {
  name: 'フォーマットで本文が変わる',
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    await expect(readEditorLines(editor)).toEqual(SAMPLE_CODE.split('\n'));

    const button = await canvas.findByRole('button', { name: 'フォーマット' });
    await expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+Enter Meta+Enter');
    await userEvent.click(button);

    await waitFor(() => expect(readEditorLines(editor)).toEqual(FORMATTED_CODE.split('\n')));
    // 通常の編集と同じく下書き保存の対象になる（JSON 文字列なので引用符は含めない）
    await waitFor(() =>
      expect(window.localStorage.getItem(draftStorageKey(STORAGE_KEY))).toContain(
        'func main() { fmt.Println(',
      ),
    );

    // 置き換えは 1 トランザクションなので undo で元に戻せる
    await userEvent.click(editor);
    await userEvent.keyboard('{Control>}z{/Control}');
    await waitFor(() => expect(readEditorLines(editor)).toEqual(SAMPLE_CODE.split('\n')));
  },
};

export const FormatSyntaxError: Story = {
  name: '構文エラーでは本文を変えない',
  args: {
    engine: createMockEngine({
      format: () => Promise.resolve({ status: 'error', error: FORMAT_ERROR }),
    }),
  },
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    await userEvent.click(await canvas.findByRole('button', { name: 'フォーマット' }));

    await expect(
      await canvas.findByText(`フォーマットできませんでした: ${FORMAT_ERROR}`),
    ).toBeVisible();
    await expect(readEditorLines(editor)).toEqual(SAMPLE_CODE.split('\n'));
    await expect(window.localStorage.getItem(draftStorageKey(STORAGE_KEY))).toBeNull();
  },
};

export const RunWithShiftEnter: Story = {
  name: 'エディタで Shift + Enter 実行',
  args: {
    engine: createMockEngine({ events: [{ type: 'stdout', data: 'Hello, 世界\n' }] }),
  },
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    await expect(await canvas.findByRole('button', { name: '実行' })).toHaveAttribute(
      'aria-keyshortcuts',
      'Shift+Enter',
    );

    await userEvent.click(editor);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');

    const output = await canvas.findByRole('log');
    await expect(await within(output).findByText(/Hello, 世界/)).toBeVisible();
    await expect(await within(output).findByText('終了（7 ms）')).toBeVisible();
    // 実行キーは本文に改行を入れない
    await expect(readEditorLines(editor)).toEqual(SAMPLE_CODE.split('\n'));
  },
};

export const RunWithShiftEnterOutsideEditor: Story = {
  name: 'エディタ外の Shift + Enter 実行',
  args: {
    engine: createMockEngine({ events: [{ type: 'stdout', data: 'outside\n' }] }),
  },
  play: async ({ canvas, userEvent }) => {
    // ファイル名のラベル（フォーカス可能な要素ではない）を押して、本文にフォーカスを移す
    await userEvent.click(await canvas.findByText('packages.go'));
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');

    const output = await canvas.findByRole('log');
    await expect(await within(output).findByText('outside')).toBeVisible();
  },
};

/**
 * モーダルのダイアログ（表示設定や目次）を開いている間は、エディタ外の
 * Shift + Enter でコードを実行しない。フォーカスはダイアログ自身に置いて、
 * 「ボタンの上だから偶然避けられた」ではないことを確かめる。
 */
function DialogHarness(args: ComponentProps<typeof CodeRunner>) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => setOpen(true)}>
        ダイアログを開く
      </button>
      <CodeRunner {...args} />
      <dialog
        ref={dialogRef}
        tabIndex={-1}
        aria-label="テスト用ダイアログ"
        onClose={() => setOpen(false)}
      >
        <p>ダイアログを開いている間は Shift + Enter で実行しない。</p>
        <button type="button" onClick={() => setOpen(false)}>
          閉じる
        </button>
      </dialog>
    </div>
  );
}

export const NoRunWhileDialogOpen: Story = {
  name: 'ダイアログ内では Shift + Enter で実行しない',
  args: {
    engine: createMockEngine({ events: [{ type: 'stdout', data: 'dialog\n' }] }),
  },
  render: (args) => <DialogHarness {...args} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'ダイアログを開く' }));
    const dialog = await canvas.findByRole('dialog', { name: 'テスト用ダイアログ' });
    await expect(dialog).toBeVisible();
    dialog.focus();

    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await new Promise((resolve) => setTimeout(resolve, 100));

    const output = canvas.getByRole('log');
    await expect(within(output).queryByText('dialog')).not.toBeInTheDocument();
    await expect(dialog).toBeVisible();
  },
};

export const FormatWithControlEnter: Story = {
  name: 'エディタで Ctrl + Enter フォーマット',
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole('textbox', { name: /packages.go のコード/ });
    await userEvent.click(editor);
    await userEvent.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(readEditorLines(editor)).toEqual(FORMATTED_CODE.split('\n')));
    await waitFor(() =>
      expect(window.localStorage.getItem(draftStorageKey(STORAGE_KEY))).toContain(
        'func main() { fmt.Println(',
      ),
    );
  },
};

/**
 * 実際の wasm ランナーを使う手動確認用の story。CI（vitest）では実行しない。
 * 動かすには `pnpm build`（prebuild で public/wasm を生成）後に `pnpm storybook` を開く。
 */
export const RealWasm: Story = {
  name: '実 wasm（手動確認）',
  tags: ['!test'],
  args: { engine: undefined },
};
