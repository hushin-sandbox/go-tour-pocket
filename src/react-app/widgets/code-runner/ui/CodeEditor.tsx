import { useEffect, useRef } from 'react';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { go } from '@codemirror/lang-go';
import {
  HighlightStyle,
  bracketMatching,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState } from '@codemirror/state';
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

export interface CodeEditorProps {
  value: string;
  fileName: string;
  fontSize: CodeFontSize;
  onChange: (value: string) => void;
}

/**
 * CodeMirror 6 の薄いラッパー。エディタ本体はマウント時に 1 回だけ作り、
 * 親から渡された値の変化だけを dispatch で反映する。
 */
export function CodeEditor({ value, fileName, fontSize, onChange }: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);
  const fontSizeRef = useRef(fontSize);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return () => {};

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
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
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
    if (fontSizeRef.current === fontSize) return;
    fontSizeRef.current = fontSize;
    // 文字サイズは CSS 変数で変わるため、CodeMirror に再計測させる
    viewRef.current?.requestMeasure();
  }, [fontSize]);

  return <div ref={hostRef} className="code-runner-editor" />;
}
