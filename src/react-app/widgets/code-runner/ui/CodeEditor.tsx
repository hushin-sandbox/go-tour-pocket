import { useEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { go } from '@codemirror/lang-go';
import {
  HighlightStyle,
  bracketMatching,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { Compartment, EditorState, Text } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type { CodeFontSize } from '../lib/storage';

const highlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.keyword,
      tags.modifier,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
      tags.operatorKeyword,
    ],
    color: 'var(--code-runner-syntax-keyword)',
  },
  {
    tag: [tags.string, tags.character],
    color: 'var(--code-runner-syntax-string)',
  },
  {
    tag: [tags.number, tags.bool, tags.null],
    color: 'var(--code-runner-syntax-number)',
  },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    color: 'var(--code-runner-syntax-comment)',
    fontStyle: 'italic',
  },
  {
    tag: [tags.typeName, tags.className],
    color: 'var(--code-runner-syntax-type)',
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--code-runner-syntax-function)',
  },
  {
    tag: [tags.propertyName, tags.labelName],
    color: 'var(--code-runner-syntax-property)',
  },
  {
    tag: [tags.operator, tags.arithmeticOperator, tags.logicOperator, tags.compareOperator],
    color: 'var(--code-runner-syntax-operator)',
  },
  {
    tag: [tags.invalid],
    color: 'var(--code-runner-syntax-invalid)',
  },
]);

const mobileInputAttributes = {
  autocapitalize: 'off',
  autocomplete: 'off',
  autocorrect: 'off',
  spellcheck: 'false',
} as const;

export interface CodeEditorHandle {
  /**
   * フォーマット結果などで本文を丸ごと差し替える。undo できる 1 トランザクションで
   * 置き換え、行番号と桁を手がかりにカーソル位置をできるだけ保つ。
   */
  replaceDoc(value: string): void;
}

export interface CodeEditorProps {
  value: string;
  fileName: string;
  fontSize: CodeFontSize;
  /** 長い行をエディタの幅で折り返すか */
  lineWrapping: boolean;
  onChange: (value: string) => void;
  /** エディタにフォーカスがあるときの実行（Shift + Enter） */
  onRun?: () => void;
  /** エディタにフォーカスがあるときのフォーマット（Ctrl / Cmd + Enter） */
  onFormat?: () => void;
  ref?: Ref<CodeEditorHandle>;
}

/**
 * CodeMirror 6 の薄いラッパー。エディタ本体はマウント時に 1 回だけ作り、
 * 親から渡された値の変化だけを dispatch で反映する。
 */
export function CodeEditor({
  value,
  fileName,
  fontSize,
  lineWrapping,
  onChange,
  onRun,
  onFormat,
  ref,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  const onFormatRef = useRef(onFormat);
  const initialValueRef = useRef(value);
  const fontSizeRef = useRef(fontSize);
  const lineWrappingRef = useRef(lineWrapping);
  const wrapCompartmentRef = useRef<Compartment | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onRunRef.current = onRun;
    onFormatRef.current = onFormat;
  }, [onRun, onFormat]);

  useImperativeHandle(
    ref,
    () => ({
      replaceDoc: (next: string) => {
        const view = viewRef.current;
        if (view === null) return;
        const current = view.state.doc.toString();
        if (current === next) return;

        // 行番号と桁で位置を写す。行数が減ったときは末尾行に、桁が縮んだ行では行末に寄せる。
        const head = view.state.selection.main.head;
        const currentLine = view.state.doc.lineAt(head);
        const lineNumber = currentLine.number;
        const column = head - currentLine.from;
        const nextDoc = Text.of(next.split('\n'));
        const nextLine = nextDoc.line(Math.min(lineNumber, nextDoc.lines));
        const anchor = nextLine.from + Math.min(column, nextLine.length);

        view.dispatch({
          changes: { from: 0, to: current.length, insert: next },
          selection: { anchor },
          scrollIntoView: true,
        });
      },
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return () => {};

    // 折り返しはマウント後にも切り替えるため、専用の Compartment に入れておく。
    const wrapCompartment = wrapCompartmentRef.current ?? new Compartment();
    wrapCompartmentRef.current = wrapCompartment;

    const view = new EditorView({
      state: EditorState.create({
        doc: initialValueRef.current,
        extensions: [
          lineNumbers(),
          history(),
          bracketMatching(),
          go(),
          syntaxHighlighting(highlightStyle),
          indentUnit.of('\t'),
          EditorState.tabSize.of(4),
          wrapCompartment.of(lineWrappingRef.current ? EditorView.lineWrapping : []),
          // Shift + Enter / Ctrl (Cmd) + Enter は defaultKeymap の割り当てより先に
          // 見てほしいので、この 2 つを先頭に置く。
          keymap.of([
            {
              key: 'Shift-Enter',
              run: () => {
                if (onRunRef.current === undefined) return false;
                onRunRef.current();
                return true;
              },
            },
            {
              key: 'Mod-Enter',
              run: () => {
                if (onFormatRef.current === undefined) return false;
                onFormatRef.current();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            indentWithTab,
          ]),
          EditorView.contentAttributes.of(mobileInputAttributes),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
      parent: host,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // エディタはマウント時に一度だけ作る。fileName の変更は下の effect で反映する。
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (view === null) return;
    view.contentDOM.setAttribute('aria-label', `${fileName} のコード`);
  }, [fileName]);

  useEffect(() => {
    if (lineWrappingRef.current === lineWrapping) return;
    lineWrappingRef.current = lineWrapping;
    const view = viewRef.current;
    const compartment = wrapCompartmentRef.current;
    if (view === null || compartment === null) return;
    view.dispatch({
      effects: compartment.reconfigure(lineWrapping ? EditorView.lineWrapping : []),
    });
  }, [lineWrapping]);

  useEffect(() => {
    if (fontSizeRef.current === fontSize) return;
    fontSizeRef.current = fontSize;
    // 文字サイズは CSS 変数で変わるため、CodeMirror に再計測させる
    viewRef.current?.requestMeasure();
  }, [fontSize]);

  return <div ref={hostRef} className="code-runner-editor" />;
}
