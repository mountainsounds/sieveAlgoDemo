import { describe, expect, it } from 'vitest';
import { registry } from '../src/registry';
import { hangFor, indentOf, wrapPoints } from '../src/ui/wrap';

type Language = 'javascript' | 'python' | 'java';

/** The rows a line breaks into, each trimmed the way it draws. */
function rows(line: string, cols: number, hang: number): string[] {
  const points = wrapPoints(line, cols, hang);
  return [0, ...points].map((start, k) => line.slice(start, points[k] ?? line.length).trimEnd());
}

describe('indentOf', () => {
  it('counts leading spaces', () => {
    expect(indentOf('')).toBe(0);
    expect(indentOf('function mergeSort(a) {')).toBe(0);
    expect(indentOf('    return merged;')).toBe(4);
  });
});

describe('wrapPoints', () => {
  it('leaves a line that fits alone', () => {
    expect(wrapPoints('  return a;', 44, 4)).toEqual([]);
    expect(wrapPoints('x'.repeat(44), 44, 4)).toEqual([]);
  });

  /* The lines below are the ones a plain browser wrap got wrong. */

  it('splits a for header between its clauses, not inside one', () => {
    expect(rows('  for (let lo = 0; lo < a.length; lo += 2 * width) {', 44, 4)).toEqual([
      '  for (let lo = 0; lo < a.length;',
      'lo += 2 * width) {',
    ]);
  });

  it('splits a one-line if between its test and its body', () => {
    expect(rows('    if (isPrime[i]) strikeMultiples(isPrime, i);', 44, 4)).toEqual([
      '    if (isPrime[i])',
      'strikeMultiples(isPrime, i);',
    ]);
    expect(rows('  while (left < mid) out[next++] = a[left++];', 44, 4)).toEqual([
      '  while (left < mid)',
      'out[next++] = a[left++];',
    ]);
  });

  it('never strands a brace or a type away from its name', () => {
    expect(rows('static int[] mergeRuns(int[] a, int width) {', 43, 4)).toEqual([
      'static int[] mergeRuns(int[] a,',
      'int width) {',
    ]);
    expect(rows('static void merge(int[] a, int[] out, int lo, int width) {', 44, 4)).toEqual([
      'static void merge(int[] a, int[] out,',
      'int lo, int width) {',
    ]);
  });

  it('opens a signature after its paren when no comma is in reach', () => {
    expect(rows('static void strikeMultiples(boolean[] isPrime, int p) {', 44, 4)).toEqual([
      'static void strikeMultiples(',
      'boolean[] isPrime, int p) {',
    ]);
  });

  it('breaks before a logical operator', () => {
    expect(rows('  while (i < left.length && j < right.length) {', 44, 4)).toEqual([
      '  while (i < left.length',
      '&& j < right.length) {',
    ]);
  });

  it('splits a tuple swap at its =, not between the items', () => {
    expect(rows('            a[i], a[boundary] = a[boundary], a[i]', 44, 8)).toEqual([
      '            a[i], a[boundary] =',
      'a[boundary], a[i]',
    ]);
    expect(rows('    a[boundary], a[hi] = a[hi], a[boundary]', 41, 8)).toEqual([
      '    a[boundary], a[hi] =',
      'a[hi], a[boundary]',
    ]);
  });

  it('prefers three clean rows to two that split an expression', () => {
    expect(rows('  for (let width = 1; width < a.length; width *= 2) {', 35, 4)).toEqual([
      '  for (let width = 1;',
      'width < a.length;',
      'width *= 2) {',
    ]);
  });

  it('cuts a token only when nothing else fits', () => {
    expect(rows('  abcdefghijklmnop', 10, 4)).toEqual(['  abcdefgh', 'ijkl', 'mnop']);
  });
});

describe('every listing', () => {
  const listings = registry.flatMap(({ def }) => def.listings);

  /**
   * On a narrow panel a long line wraps and its wrapped rows hang two indent
   * steps past the line itself, deeper than any line nested under it. That
   * only holds if every listing indents by one steady step.
   */
  it('hangs wrapped rows two indent steps deep', () => {
    const hang: Record<Language, number> = { javascript: 4, python: 8, java: 4 };
    for (const listing of listings) {
      const expected = hang[listing.language as Language];
      expect(hangFor(listing.code), listing.label).toBe(expected);
      for (const line of listing.code.split('\n')) {
        expect(indentOf(line) % (expected / 2), `${listing.label} «${line}»`).toBe(0);
      }
    }
  });

  it('wraps every line into rows that fit, at every width a panel can have', () => {
    for (const listing of listings) {
      const hang = hangFor(listing.code);
      for (const line of listing.code.split('\n')) {
        const indent = indentOf(line);
        for (let cols = 24; cols <= 60; cols++) {
          if (cols - indent - hang < 1) continue;
          const where = `${listing.label} at ${cols}: «${line}»`;
          const points = wrapPoints(line, cols, hang);
          const drawn = rows(line, cols, hang);
          // Rows are in order, and the first one holds code, not just indentation.
          expect(points, where).toEqual([...points].sort((x, y) => x - y));
          if (points.length > 0) expect(points[0], where).toBeGreaterThan(indent);
          // No row is wider than its room, and no wrapped row starts with a space.
          expect(drawn[0]?.length ?? 0, where).toBeLessThanOrEqual(cols);
          for (const row of drawn.slice(1)) {
            expect(row.length, where).toBeLessThanOrEqual(cols - indent - hang);
            expect(row.startsWith(' '), where).toBe(false);
          }
        }
      }
    }
  });

  it('never cuts a token at the widths a phone gets', () => {
    for (const listing of listings) {
      const hang = hangFor(listing.code);
      for (const line of listing.code.split('\n')) {
        for (let cols = 40; cols <= 60; cols++) {
          for (const point of wrapPoints(line, cols, hang)) {
            const where = `${listing.label} at ${cols}: «${line}» at ${point}`;
            expect(line[point - 1] === ' ' || line[point - 1] === '(', where).toBe(true);
          }
        }
      }
    }
  });
});
