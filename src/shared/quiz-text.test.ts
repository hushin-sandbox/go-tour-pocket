import { describe, expect, it } from 'vitest';
import { parseQuizText, quizTextProblem } from './quiz-text.ts';

describe('parseQuizText', () => {
  it('keeps spaces inside a code span', () => {
    expect(parseQuizText('`[John XXX] [John Paul George Ringo]`')).toEqual([
      { type: 'code', value: '[John XXX] [John Paul George Ringo]' },
    ]);
  });

  it('splits text and several code spans next to Japanese text', () => {
    expect(parseQuizText('1 行目が`true 0 0`、2 行目が `2 [1 2]`')).toEqual([
      { type: 'text', value: '1 行目が' },
      { type: 'code', value: 'true 0 0' },
      { type: 'text', value: '、2 行目が ' },
      { type: 'code', value: '2 [1 2]' },
    ]);
  });

  it('does not interpret present markers', () => {
    expect(parseQuizText('*T と _x_')).toEqual([{ type: 'text', value: '*T と _x_' }]);
  });

  it('does not emit empty tokens for an empty code span', () => {
    expect(parseQuizText('a `` b')).toEqual([{ type: 'text', value: 'a  b' }]);
  });

  it('treats an unpaired backquote and the rest as text', () => {
    expect(parseQuizText('`a` と `b')).toEqual([
      { type: 'code', value: 'a' },
      { type: 'text', value: ' と `b' },
    ]);
  });

  it('returns no tokens for an empty string', () => {
    expect(parseQuizText('')).toEqual([]);
  });
});

describe('quizTextProblem', () => {
  it('accepts paired code spans', () => {
    expect(quizTextProblem('`0 false` と `x`')).toBeUndefined();
  });

  it('reports an odd number of backquotes', () => {
    expect(quizTextProblem('`0 false')).toBe('unpaired');
    expect(quizTextProblem('`a` と `b` と `c')).toBe('unpaired');
  });

  it('reports an empty code span', () => {
    expect(quizTextProblem('a `` b')).toBe('empty-code');
  });
});
