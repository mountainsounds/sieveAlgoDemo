import { describe, expect, it } from 'vitest';
import {
  binarySearch,
  buildSearchSteps,
  probeCap,
  sortedValues,
  SIZE,
  TARGET,
  type SearchStep,
} from '../src/algorithms/binary-search';

const sizes = Array.from({ length: SIZE.max - SIZE.min + 1 }, (_, k) => SIZE.min + k);
const targets = Array.from({ length: TARGET.max - TARGET.min + 1 }, (_, k) => TARGET.min + k);

describe('sortedValues', () => {
  it('is deterministic, strictly increasing, and in range for every size', () => {
    for (const size of sizes) {
      const values = sortedValues(size);
      expect(values).toEqual(sortedValues(size));
      expect(values).toHaveLength(size);
      for (const [i, v] of values.entries()) {
        expect(v, `size=${size} i=${i}`).toBeGreaterThanOrEqual(2);
        expect(v, `size=${size} i=${i}`).toBeLessThanOrEqual(TARGET.max);
        if (i > 0) expect(v, `size=${size} i=${i}`).toBeGreaterThan(values[i - 1] ?? Infinity);
      }
    }
  });
});

describe('binarySearch', () => {
  it('matches a linear scan for every size and target', () => {
    for (const size of sizes) {
      const values = sortedValues(size);
      for (const target of targets) {
        expect(binarySearch(values, target), `size=${size} target=${target}`).toBe(
          values.indexOf(target),
        );
      }
    }
  });
});

describe('buildSearchSteps', () => {
  it('ends in found exactly when the target is present, matching the search', () => {
    for (const size of sizes) {
      const values = sortedValues(size);
      for (const target of targets) {
        const last = buildSearchSteps(values, target).at(-1);
        const index = binarySearch(values, target);
        if (index >= 0) {
          expect(last, `size=${size} target=${target}`).toMatchObject({
            kind: 'found',
            index,
            value: target,
          });
        } else {
          expect(last, `size=${size} target=${target}`).toMatchObject({ kind: 'not-found' });
        }
      }
    }
  });

  it('keeps every index in bounds and every probe inside the window', () => {
    for (const size of sizes) {
      const values = sortedValues(size);
      for (const target of targets) {
        for (const step of buildSearchSteps(values, target)) {
          if (step.kind === 'probe') {
            expect(step.lo).toBeGreaterThanOrEqual(0);
            expect(step.hi).toBeLessThan(size);
            expect(step.mid).toBeGreaterThanOrEqual(step.lo);
            expect(step.mid).toBeLessThanOrEqual(step.hi);
          }
          if (step.kind === 'discard') {
            expect(step.from).toBeGreaterThanOrEqual(0);
            expect(step.to).toBeLessThan(size);
            expect(step.from).toBeLessThanOrEqual(step.to);
          }
          if (step.kind === 'found') {
            expect(values[step.index]).toBe(step.value);
          }
        }
      }
    }
  });

  it('strictly shrinks the window on every discard', () => {
    for (const size of sizes) {
      const values = sortedValues(size);
      for (const target of targets) {
        let span = size;
        for (const step of buildSearchSteps(values, target)) {
          if (step.kind !== 'discard') continue;
          const next = Math.max(0, step.hi - step.lo + 1);
          expect(next, `size=${size} target=${target}`).toBeLessThan(span);
          // The discarded run is exactly what the window lost.
          expect(next + (step.to - step.from + 1), `size=${size} target=${target}`).toBe(span);
          span = next;
        }
      }
    }
  });

  it('never needs more than the probe cap the chip advertises', () => {
    for (const size of sizes) {
      const values = sortedValues(size);
      const cap = probeCap(size);
      for (const target of targets) {
        const steps = buildSearchSteps(values, target);
        const probes = steps.filter((s: SearchStep) => s.kind === 'probe').length;
        expect(probes, `size=${size} target=${target}`).toBeGreaterThan(0);
        expect(probes, `size=${size} target=${target}`).toBeLessThanOrEqual(cap);
        const last = steps.at(-1);
        if (last?.kind === 'found' || last?.kind === 'not-found') {
          expect(last.probes).toBe(probes);
        }
      }
    }
  });
});
