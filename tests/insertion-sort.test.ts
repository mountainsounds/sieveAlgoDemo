import { describe, expect, it } from 'vitest';
import { arrangeValues, orderLabel, ORDER, ORDER_OPTIONS } from '../src/algorithms/arrange';
import {
  buildSortSteps,
  insertionSort,
  SIZE,
  type SortStep,
} from '../src/algorithms/insertion-sort';

const sizes = Array.from({ length: SIZE.max - SIZE.min + 1 }, (_, k) => SIZE.min + k);
const orders = ORDER_OPTIONS.map((option) => option.value);
const ascending = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);

/** Replays a step stream the way the view does, and returns the final row. */
function replay(steps: readonly SortStep[], size: number): (number | null)[] {
  const slots: (number | null)[] = new Array<number | null>(size).fill(null);
  let key: number | null = null;
  for (const step of steps) {
    switch (step.kind) {
      case 'init':
        step.values.forEach((value, index) => (slots[index] = value));
        break;
      case 'pick':
        expect(slots[step.i], 'the picked slot holds the key').toBe(step.key);
        key = step.key;
        slots[step.i] = null;
        break;
      case 'shift':
        expect(slots[step.to], 'a shift only ever moves into the gap').toBeNull();
        slots[step.to] = slots[step.from] ?? null;
        slots[step.from] = null;
        break;
      case 'place':
        expect(slots[step.slot], 'the key drops into the gap').toBeNull();
        expect(key, 'a place always follows a pick').toBe(step.key);
        slots[step.slot] = step.key;
        key = null;
        break;
      default:
        break;
    }
  }
  expect(key, 'no key is left floating').toBeNull();
  return slots;
}

describe('arrangeValues', () => {
  it('is deterministic and holds distinct in-range values for every size and order', () => {
    for (const size of sizes) {
      for (const order of orders) {
        const values = arrangeValues(size, order);
        expect(values, `size=${size} order=${order}`).toEqual(arrangeValues(size, order));
        expect(values).toHaveLength(size);
        expect(new Set(values).size, `size=${size} order=${order}`).toBe(size);
        for (const value of values) {
          expect(value, `size=${size} order=${order}`).toBeGreaterThanOrEqual(8);
          expect(value, `size=${size} order=${order}`).toBeLessThanOrEqual(92);
        }
      }
    }
  });

  it('gives each order the shape its label promises', () => {
    for (const size of sizes) {
      const shuffled = arrangeValues(size, ORDER.shuffled);
      const nearly = arrangeValues(size, ORDER.nearly);
      const reversed = arrangeValues(size, ORDER.reversed);
      // Reversed is the worst case: every pair is out of order.
      expect(reversed, `size=${size}`).toEqual(ascending(reversed).reverse());
      // Nearly sorted is the best case: a handful of adjacent transpositions.
      expect(inversions(nearly), `size=${size}`).toBeLessThanOrEqual(Math.ceil(size / 5));
      // Shuffled has to actually be out of order, or the demo shows nothing.
      expect(shuffled, `size=${size}`).not.toEqual(ascending(shuffled));
      expect(inversions(shuffled), `size=${size}`).toBeGreaterThan(inversions(nearly));
    }
  });
});

function inversions(values: readonly number[]): number {
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if ((values[i] ?? 0) > (values[j] ?? 0)) count++;
    }
  }
  return count;
}

describe('insertionSort', () => {
  it('matches a plain numeric sort for every size and order', () => {
    for (const size of sizes) {
      for (const order of orders) {
        const values = arrangeValues(size, order);
        expect(insertionSort(values), `size=${size} order=${order}`).toEqual(ascending(values));
      }
    }
  });
});

describe('buildSortSteps', () => {
  it('leaves the row sorted, with every value still in it', () => {
    for (const size of sizes) {
      for (const order of orders) {
        const values = arrangeValues(size, order);
        const steps = buildSortSteps(values, orderLabel(order));
        expect(replay(steps, size), `size=${size} order=${order}`).toEqual(ascending(values));
      }
    }
  });

  it('keeps every index inside the row (the 2021 crash class)', () => {
    for (const size of sizes) {
      for (const order of orders) {
        for (const step of buildSortSteps(arrangeValues(size, order), 'test')) {
          const context = `size=${size} order=${order} kind=${step.kind}`;
          if (step.kind === 'pick') {
            expect(step.i, context).toBeGreaterThan(0);
            expect(step.i, context).toBeLessThan(size);
          }
          if (step.kind === 'compare') {
            expect(step.j, context).toBeGreaterThanOrEqual(0);
            expect(step.j, context).toBeLessThan(size);
          }
          if (step.kind === 'shift') {
            expect(step.from, context).toBeGreaterThanOrEqual(0);
            expect(step.to, context).toBe(step.from + 1);
            expect(step.to, context).toBeLessThan(size);
          }
          if (step.kind === 'place') {
            expect(step.slot, context).toBeGreaterThanOrEqual(0);
            expect(step.slot, context).toBeLessThanOrEqual(step.sorted);
          }
        }
      }
    }
  });

  it('counts exactly as many comparisons and shifts as it acts out', () => {
    for (const size of sizes) {
      for (const order of orders) {
        const steps = buildSortSteps(arrangeValues(size, order), 'test');
        const comparisons = steps.filter((step) => step.kind === 'compare').length;
        const shifts = steps.filter((step) => step.kind === 'shift').length;
        const last = steps.at(-1);
        expect(last?.kind, `size=${size} order=${order}`).toBe('done');
        if (last?.kind !== 'done') continue;
        expect(last.comparisons, `size=${size} order=${order}`).toBe(comparisons);
        expect(last.shifts, `size=${size} order=${order}`).toBe(shifts);
        expect(last.shifts, `size=${size} order=${order}`).toBeLessThanOrEqual(last.worst);
        expect(last.worst).toBe((size * (size - 1)) / 2);
      }
    }
  });

  it('shifts exactly the inversions in the input', () => {
    for (const size of sizes) {
      for (const order of orders) {
        const values = arrangeValues(size, order);
        const last = buildSortSteps(values, 'test').at(-1);
        if (last?.kind !== 'done') continue;
        expect(last.shifts, `size=${size} order=${order}`).toBe(inversions(values));
      }
    }
  });

  it('walks reversed input the whole way and barely moves nearly sorted input', () => {
    for (const size of sizes) {
      const reversed = buildSortSteps(arrangeValues(size, ORDER.reversed), 'test').at(-1);
      const nearly = buildSortSteps(arrangeValues(size, ORDER.nearly), 'test').at(-1);
      if (reversed?.kind !== 'done' || nearly?.kind !== 'done') continue;
      // Worst case: the key walks past the whole run on every pass.
      expect(reversed.shifts, `size=${size}`).toBe(reversed.worst);
      expect(reversed.comparisons, `size=${size}`).toBe(reversed.worst);
      // Best case: the run stays linear in n.
      expect(nearly.shifts, `size=${size}`).toBeLessThanOrEqual(Math.ceil(size / 5));
      expect(nearly.comparisons, `size=${size}`).toBeLessThan(2 * size);
    }
  });

  it('hits the left wall only when the key is the smallest so far', () => {
    for (const size of sizes) {
      for (const order of orders) {
        const values = arrangeValues(size, order);
        const steps = buildSortSteps(values, 'test');
        let key = 0;
        let smallest = values[0] ?? 0;
        for (const step of steps) {
          if (step.kind === 'pick') {
            key = step.key;
            smallest = Math.min(...values.slice(0, step.i));
          }
          if (step.kind === 'wall') {
            expect(step.key, `size=${size} order=${order}`).toBe(key);
            expect(key, `size=${size} order=${order}`).toBeLessThan(smallest);
          }
        }
      }
    }
  });
});

describe('orderLabel', () => {
  it('names every option and falls back for anything else', () => {
    for (const option of ORDER_OPTIONS) expect(orderLabel(option.value)).toBe(option.label);
    expect(orderLabel(99)).toBe('shuffled');
  });
});
