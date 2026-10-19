import { describe, expect, it } from 'vitest';
import { codeLines, extractCode, resolveAddress } from './code.ts';

const PROGRAM = [
  'package main',
  '',
  '// START OMIT',
  'func main() {',
  '\tprintln("hi")',
  '}',
  '// END OMIT',
  '',
  '',
].join('\n');

describe('extractCode', () => {
  it('removes OMIT lines and trims leading/trailing blank lines', () => {
    expect(extractCode(PROGRAM, '')).toBe('package main\n\nfunc main() {\n\tprintln("hi")\n}\n');
  });

  it('extracts a /START/,/END/ address range', () => {
    expect(extractCode(PROGRAM, '/START OMIT/,/END OMIT/')).toBe(
      'func main() {\n\tprintln("hi")\n}\n',
    );
  });

  it('extracts a line number', () => {
    expect(extractCode('a\nb\nc\n', '2')).toBe('b\n');
  });

  it('wraps forward regexp searches like present', () => {
    expect(resolveAddress('/c/', 0, 'a\nb\nc\n')).toEqual({ lo: 4, hi: 5 });
    expect(resolveAddress('/a/', 4, 'a\nb\nc\n')).toEqual({ lo: 0, hi: 1 });
  });

  it('throws for a missing match', () => {
    expect(() => extractCode('a\nb\n', '/nope/')).toThrow(/no match/);
  });
});

describe('codeLines', () => {
  it('keeps internal blank lines', () => {
    expect(codeLines('a\n\nb\n')).toBe('a\n\nb\n');
  });

  it('drops blank lines at both ends', () => {
    expect(codeLines('\n\na\n\n')).toBe('a\n');
  });

  it('returns an empty string for an empty range', () => {
    expect(codeLines('')).toBe('');
  });
});
