import { codeHash } from './code-hash';

describe('codeHash', () => {
  it('returns a stable 12 character hex digest', () => {
    expect(codeHash('package main\n')).toMatch(/^[0-9a-f]{12}$/);
    expect(codeHash('package main\n')).toBe(codeHash('package main\n'));
  });

  it('changes when the code changes', () => {
    expect(codeHash('package main\n')).not.toBe(codeHash('package main\n\n'));
  });

  it('handles an empty string', () => {
    expect(codeHash('')).toMatch(/^[0-9a-f]{12}$/);
  });
});
