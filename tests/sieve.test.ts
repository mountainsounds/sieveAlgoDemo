import { describe, expect, it } from 'vitest';
import { buildSteps, countPrimes } from '../src/algorithms/sieve';

function naiveIsPrime(v: number): boolean {
  if (v < 2) return false;
  for (let d = 2; d * d <= v; d++) {
    if (v % d === 0) return false;
  }
  return true;
}

describe('countPrimes', () => {
  it.each([
    [2, 0],
    [3, 1],
    [10, 4],
    [30, 10],
    [100, 25],
    [120, 30],
  ])('counts primes below %i as %i', (n, expected) => {
    expect(countPrimes(n)).toBe(expected);
  });

  it('matches a naive count for every n in range', () => {
    for (let n = 2; n <= 120; n++) {
      let expected = 0;
      for (let v = 2; v < n; v++) if (naiveIsPrime(v)) expected++;
      expect(countPrimes(n), `n=${n}`).toBe(expected);
    }
  });
});

describe('buildSteps', () => {
  it('ends with a done step matching the pure result', () => {
    for (const n of [2, 3, 4, 10, 30, 97, 120]) {
      const steps = buildSteps(n);
      const last = steps[steps.length - 1];
      expect(last).toEqual({ kind: 'done', count: countPrimes(n), n });
    }
  });

  it('never references a value outside the grid (the 2021 crash)', () => {
    for (const n of [2, 10, 30, 120]) {
      for (const step of buildSteps(n)) {
        if (step.kind === 'strike') expect(step.value).toBeLessThan(n);
        if (
          step.kind === 'prime-found' ||
          step.kind === 'composite-skip' ||
          step.kind === 'count-visit'
        ) {
          expect(step.i).toBeLessThan(n);
        }
      }
    }
  });

  it('strikes exactly the composites from 4 up', () => {
    const n = 60;
    const struck = new Set<number>();
    for (const step of buildSteps(n)) {
      if (step.kind === 'strike') struck.add(step.value);
    }
    for (let v = 4; v < n; v++) {
      expect(struck.has(v), `v=${v}`).toBe(!naiveIsPrime(v));
    }
  });

  it('marks i prime in count-visit exactly when i is prime', () => {
    for (const step of buildSteps(100)) {
      if (step.kind === 'count-visit') {
        expect(step.prime, `i=${step.i}`).toBe(naiveIsPrime(step.i));
      }
    }
  });
});
