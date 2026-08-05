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

/**
 * The generator binary-search.ts carried privately before random.ts existed.
 * Kept here so the shared extraction can never quietly move the demo arrays.
 */
function legacySortedValues(size: number): number[] {
  let a = (size * 0x9e3779b9 + 7) >>> 0;
  const rand = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gap = (TARGET.max - 2) / size;
  const out: number[] = [];
  let prev = 1;
  for (let i = 0; i < size; i++) {
    const center = 2 + (i + 0.5) * gap;
    const jittered = Math.round(center + (rand() - 0.5) * gap * 0.9);
    const v = Math.min(TARGET.max, Math.max(prev + 1, jittered));
    out.push(v);
    prev = v;
  }
  return out;
}

describe('sortedValues', () => {
  it('still produces the arrays it shipped with', () => {
    for (const size of sizes) {
      expect(sortedValues(size), `size=${size}`).toEqual(legacySortedValues(size));
    }
  });

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

  it('names the true neighbors around every missed target', () => {
    for (const size of sizes) {
      const values = sortedValues(size);
      for (const target of targets) {
        if (values.includes(target)) continue;
        const last = buildSearchSteps(values, target).at(-1);
        expect(last?.kind, `size=${size} target=${target}`).toBe('not-found');
        if (last?.kind !== 'not-found') continue;
        const below = values.filter((v) => v < target).at(-1) ?? null;
        const above = values.find((v) => v > target) ?? null;
        expect(last.below, `size=${size} target=${target}`).toBe(below);
        expect(last.above, `size=${size} target=${target}`).toBe(above);
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
