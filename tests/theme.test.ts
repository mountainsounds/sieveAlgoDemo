import { describe, expect, it } from 'vitest';
import { resolveTheme } from '../src/theme';

describe('resolveTheme', () => {
  it('honors a stored choice regardless of the OS preference', () => {
    expect(resolveTheme('signal', true)).toBe('signal');
    expect(resolveTheme('notebook', false)).toBe('notebook');
  });

  it('falls back to the OS preference when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('notebook');
    expect(resolveTheme(null, false)).toBe('signal');
  });

  it('ignores junk stored values', () => {
    expect(resolveTheme('aurora', false)).toBe('signal');
    expect(resolveTheme('', true)).toBe('notebook');
  });
});
