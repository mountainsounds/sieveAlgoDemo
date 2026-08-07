import { describe, expect, it } from 'vitest';
import { arrangeValues, orderLabel, ORDER, ORDER_OPTIONS } from '../src/algorithms/arrange';
import {
  buildQuickSteps,
  quickSort,
  quickSortAlgo,
  worstCase,
  SIZE,
  type QuickStep,
} from '../src/algorithms/quick-sort';

const sizes = Array.from({ length: SIZE.max - SIZE.min + 1 }, (_, k) => SIZE.min + k);
const orders = ORDER_OPTIONS.map((option) => option.value);
const ascending = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);
const every = (visit: (size: number, order: number) => void): void => {
  for (const size of sizes) for (const order of orders) visit(size, order);
};
const finish = (size: number, order: number): Extract<QuickStep, { kind: 'done' }> => {
  const last = buildQuickSteps(arrangeValues(size, order), 'test').at(-1);
  if (last?.kind !== 'done') throw new Error('no done step');
  return last;
};

/** Replays a step stream the way the view does, and returns the final row. */
function replay(steps: readonly QuickStep[]): number[] {
  let row: number[] = [];
  /** Slots holding a settled pivot, and the value that settled there. */
  const locked = new Map<number, number>();
  const move = (x: number, y: number): void => {
    const left = row[x];
    const right = row[y];
    expect(left, 'a swap only touches slots that exist').toBeDefined();
    expect(right, 'a swap only touches slots that exist').toBeDefined();
    row[x] = right as number;
    row[y] = left as number;
  };

  for (const step of steps) {
    switch (step.kind) {
      case 'init':
        row = step.values.slice();
        break;
      case 'swap':
        if (step.moved) move(step.i, step.j);
        break;
      case 'settle':
        if (step.moved) move(step.index, step.hi);
        expect(row[step.index], 'the pivot lands where settle says it does').toBe(step.value);
        locked.set(step.index, step.value);
        break;
      default:
        break;
    }
    // Whatever else happened, nothing may disturb a slot that already settled.
    for (const [slot, value] of locked) {
      expect(row[slot], `a settled pivot moved out of slot ${slot}`).toBe(value);
    }
  }
  return row;
}

describe('quickSort', () => {
  it('matches a plain numeric sort for every size and order', () => {
    every((size, order) => {
      const values = arrangeValues(size, order);
      expect(quickSort(values), `size=${size} order=${order}`).toEqual(ascending(values));
    });
  });

  it('leaves its input alone', () => {
    const values = arrangeValues(12, ORDER.shuffled);
    const before = values.slice();
    quickSort(values);
    expect(values).toEqual(before);
  });
});

describe('worstCase', () => {
  it('is n(n-1)/2', () => {
    for (let n = 0; n <= 40; n++) expect(worstCase(n), `n=${n}`).toBe((n * (n - 1)) / 2);
  });
});

describe('buildQuickSteps', () => {
  it('leaves the row sorted, with nothing disturbed after it settles', () => {
    every((size, order) => {
      const values = arrangeValues(size, order);
      const steps = buildQuickSteps(values, orderLabel(order));
      expect(replay(steps), `size=${size} order=${order}`).toEqual(ascending(values));
    });
  });

  it('keeps every index inside the row (the 2021 crash class)', () => {
    every((size, order) => {
      for (const step of buildQuickSteps(arrangeValues(size, order), 'test')) {
        const context = `size=${size} order=${order} kind=${step.kind}`;
        const inRow = (k: number): void => {
          expect(k, context).toBeGreaterThanOrEqual(0);
          expect(k, context).toBeLessThan(size);
        };
        if (step.kind === 'pivot') {
          inRow(step.index);
          inRow(step.lo);
          inRow(step.hi);
          expect(step.lo, context).toBeLessThan(step.hi);
        }
        if (step.kind === 'scan') {
          inRow(step.j);
          inRow(step.i);
          expect(step.i, context).toBeLessThanOrEqual(step.j);
        }
        if (step.kind === 'swap') {
          inRow(step.i);
          inRow(step.j);
        }
        if (step.kind === 'settle') {
          inRow(step.index);
          expect(step.index, context).toBeGreaterThanOrEqual(step.lo);
          expect(step.index, context).toBeLessThanOrEqual(step.hi);
        }
        // A call range can be empty (lo > hi); it just can't run off the row.
        if (step.kind === 'call' || step.kind === 'guard') {
          expect(step.lo, context).toBeGreaterThanOrEqual(0);
          expect(step.hi, context).toBeLessThan(size);
        }
      }
    });
  });

  /* The rail draws every frame on one line, which only works because the call
     stack never holds two ranges that overlap — or one that overlaps the range
     being partitioned. If that stopped being true the picture would lie. */
  it('never has two ranges on the stack that overlap', () => {
    every((size, order) => {
      for (const step of buildQuickSteps(arrangeValues(size, order), 'test')) {
        if (step.kind !== 'call') continue;
        const context = `size=${size} order=${order} lo=${step.lo} hi=${step.hi}`;
        const ranges = [...step.pending];
        if (step.lo <= step.hi) ranges.push([step.lo, step.hi]);
        for (const [a, range] of ranges.entries())
          for (const other of ranges.slice(a + 1))
            expect(
              range[1] < other[0] || other[1] < range[0],
              `${context}: [${range}] overlaps [${other}]`,
            ).toBe(true);
      }
    });
  });

  it('spends one comparison per scan and counts them in order', () => {
    every((size, order) => {
      let seen = 0;
      for (const step of buildQuickSteps(arrangeValues(size, order), 'test')) {
        if (step.kind !== 'scan') continue;
        seen++;
        expect(step.comparisons, `size=${size} order=${order}`).toBe(seen);
      }
      expect(finish(size, order).comparisons, `size=${size} order=${order}`).toBe(seen);
    });
  });

  it('settles exactly one value per partition, and never more than n', () => {
    every((size, order) => {
      const steps = buildQuickSteps(arrangeValues(size, order), 'test');
      const settles = steps.filter((step) => step.kind === 'settle').length;
      const context = `size=${size} order=${order}`;
      expect(finish(size, order).partitions, context).toBe(settles);
      expect(settles, context).toBeLessThanOrEqual(size);
    });
  });

  it('never spends more than the worst case', () => {
    every((size, order) => {
      const done = finish(size, order);
      expect(done.comparisons, `size=${size} order=${order}`).toBeLessThanOrEqual(done.worst);
    });
  });

  /* The reason quicksort ships next to insertion sort on the same rows: with a
     last-value pivot an ordered row is the case it handles *worst* — and
     "nearly sorted" is the row insertion sort handles best. The depth is the
     sharper tell: a shuffled row stays shallow whatever its length, an ordered
     one recurses once per value. */
  it('hits the worst case on an ordered row and stays shallow on a shuffled one', () => {
    for (const size of sizes) {
      const context = `size=${size}`;
      const shuffled = finish(size, ORDER.shuffled);
      const nearly = finish(size, ORDER.nearly);
      const reversed = finish(size, ORDER.reversed);

      // Reversed puts the pivot at one end every time: n-1, n-2, ... 1.
      expect(reversed.comparisons, `${context} reversed`).toBe(worstCase(size));
      expect(reversed.depth, `${context} reversed depth`).toBe(size);

      // Nearly sorted is a handful of transpositions off that, so it lands
      // near the worst case rather than exactly on it.
      expect(nearly.comparisons, `${context} nearly sorted`).toBeGreaterThan(
        worstCase(size) * 0.75,
      );
      expect(nearly.comparisons, `${context} nearly sorted`).toBeLessThanOrEqual(worstCase(size));

      // Shuffled costs less and, more to the point, stays O(log n) deep.
      expect(shuffled.comparisons, `${context} shuffled`).toBeLessThan(nearly.comparisons);
      expect(shuffled.depth, `${context} shuffled depth`).toBeLessThanOrEqual(
        2 * Math.log2(size) + 3,
      );
      expect(shuffled.depth, `${context} shuffled vs nearly depth`).toBeLessThanOrEqual(
        nearly.depth,
      );
      // Six values is too short for the two to pull apart; everything above it
      // separates, and the gap widens with the row (at 20 it is 6 against 15).
      if (size > 6) {
        expect(shuffled.depth, `${context} shuffled vs nearly depth`).toBeLessThan(nearly.depth);
      }
    }
  });
});

describe('quickSortAlgo', () => {
  it('narrates and paces every step kind it can emit', () => {
    const kinds = new Set<string>();
    every((size, order) => {
      for (const step of quickSortAlgo.buildSteps({ size, order })) {
        const kind = (step as QuickStep).kind;
        kinds.add(kind);
        expect(quickSortAlgo.statusText(step), kind).not.toBe('');
        expect(quickSortAlgo.delayFor(step), kind).toBeGreaterThanOrEqual(0);
        for (const listing of quickSortAlgo.listings)
          expect(listing.lineFor(step), `${listing.label} ${kind}`).not.toBeNull();
      }
    });
    expect([...kinds].sort()).toEqual([
      'call',
      'done',
      'guard',
      'init',
      'pivot',
      'scan',
      'settle',
      'swap',
    ]);
  });

  it('says so plainly when the run was the worst case', () => {
    const worstText = quickSortAlgo.statusText(
      quickSortAlgo.buildSteps({ size: 12, order: ORDER.reversed }).at(-1),
    );
    expect(worstText).toContain('the worst case');
    const luckyText = quickSortAlgo.statusText(
      quickSortAlgo.buildSteps({ size: 12, order: ORDER.shuffled }).at(-1),
    );
    expect(luckyText).not.toContain('the worst case');
    expect(luckyText).toContain('worst case 66');
  });

  it('falls back to its defaults when a control is missing', () => {
    const steps = quickSortAlgo.buildSteps({});
    const first = steps[0] as QuickStep | undefined;
    expect(first?.kind).toBe('init');
    if (first?.kind !== 'init') return;
    expect(first.values).toEqual(arrangeValues(SIZE.default, ORDER.shuffled));
  });
});
