import { describe, expect, it } from 'vitest';
import { arrangeValues, orderLabel, ORDER, ORDER_OPTIONS } from '../src/algorithms/arrange';
import {
  buildMergeSteps,
  levelCount,
  mergeSort,
  mergeSortAlgo,
  SIZE,
  type MergeStep,
} from '../src/algorithms/merge-sort';

const sizes = Array.from({ length: SIZE.max - SIZE.min + 1 }, (_, k) => SIZE.min + k);
const orders = ORDER_OPTIONS.map((option) => option.value);
const ascending = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);
const every = (visit: (size: number, order: number) => void): void => {
  for (const size of sizes) for (const order of orders) visit(size, order);
};

/** Replays a step stream the way the view does, and returns the final row. */
function replay(steps: readonly MergeStep[], size: number): (number | null)[] {
  let src: (number | null)[] = new Array<number | null>(size).fill(null);
  let out: (number | null)[] = new Array<number | null>(size).fill(null);
  for (const step of steps) {
    switch (step.kind) {
      case 'init':
        src = step.values.slice();
        break;
      case 'take':
      case 'copy':
        expect(src[step.from], 'a value is only taken once').toBe(step.value);
        expect(out[step.to], 'nothing is overwritten inside a level').toBeNull();
        out[step.to] = step.value;
        src[step.from] = null;
        break;
      case 'sweep':
        expect(out, 'a level writes every slot before it is handed on').toEqual(
          step.values.slice(),
        );
        src = out.slice();
        out = new Array<number | null>(size).fill(null);
        break;
      default:
        break;
    }
  }
  return src;
}

describe('mergeSort', () => {
  it('matches a plain numeric sort for every size and order', () => {
    every((size, order) => {
      const values = arrangeValues(size, order);
      expect(mergeSort(values), `size=${size} order=${order}`).toEqual(ascending(values));
    });
  });

  it('leaves its input alone', () => {
    const values = arrangeValues(12, ORDER.shuffled);
    const before = values.slice();
    mergeSort(values);
    expect(values).toEqual(before);
  });
});

describe('levelCount', () => {
  it('is ceil(log2 n)', () => {
    for (let n = 2; n <= 64; n++) expect(levelCount(n), `n=${n}`).toBe(Math.ceil(Math.log2(n)));
    expect(levelCount(1)).toBe(0);
    expect(levelCount(0)).toBe(0);
  });
});

describe('buildMergeSteps', () => {
  it('leaves the row sorted, with every value still in it', () => {
    every((size, order) => {
      const values = arrangeValues(size, order);
      const steps = buildMergeSteps(values, orderLabel(order));
      expect(replay(steps, size), `size=${size} order=${order}`).toEqual(ascending(values));
    });
  });

  it('keeps every index inside the row (the 2021 crash class)', () => {
    every((size, order) => {
      for (const step of buildMergeSteps(arrangeValues(size, order), 'test')) {
        const context = `size=${size} order=${order} kind=${step.kind}`;
        if (step.kind === 'runs') {
          expect(step.lo, context).toBeGreaterThanOrEqual(0);
          expect(step.lo, context).toBeLessThan(step.mid);
          expect(step.mid, context).toBeLessThan(step.hi);
          expect(step.hi, context).toBeLessThanOrEqual(size);
        }
        if (step.kind === 'lone') {
          expect(step.lo, context).toBeGreaterThanOrEqual(0);
          expect(step.lo, context).toBeLessThan(step.hi);
          expect(step.hi, context).toBe(size);
        }
        if (step.kind === 'take' || step.kind === 'copy') {
          expect(step.from, context).toBeGreaterThanOrEqual(0);
          expect(step.from, context).toBeLessThan(size);
          expect(step.to, context).toBeGreaterThanOrEqual(0);
          expect(step.to, context).toBeLessThan(size);
          for (const cursor of [step.nextA, step.nextB]) {
            if (cursor === null) continue;
            expect(cursor, context).toBeGreaterThanOrEqual(0);
            expect(cursor, context).toBeLessThan(size);
          }
        }
        if (step.kind === 'take') {
          expect(step.rival, context).toBeGreaterThanOrEqual(0);
          expect(step.rival, context).toBeLessThan(size);
        }
      }
    });
  });

  it('writes exactly n values per level, and n × levels in total', () => {
    every((size, order) => {
      const steps = buildMergeSteps(arrangeValues(size, order), 'test');
      const context = `size=${size} order=${order}`;
      const sweeps = steps.filter((step) => step.kind === 'sweep');
      const levels = levelCount(size);
      expect(sweeps, context).toHaveLength(levels);
      sweeps.forEach((sweep, index) => {
        if (sweep.kind !== 'sweep') return;
        expect(sweep.writes, `${context} sweep=${index}`).toBe(size * (index + 1));
      });
      const last = steps.at(-1);
      expect(last?.kind, context).toBe('done');
      if (last?.kind !== 'done') return;
      expect(last.writes, context).toBe(size * levels);
      expect(last.levels, context).toBe(levels);
      expect(
        steps.filter((step) => step.kind === 'take' || step.kind === 'copy').length,
        context,
      ).toBe(last.writes);
    });
  });

  /* The reason merge sort earns its own entry next to insertion sort: the
     order of the input changes nothing about how much work it does. */
  it('costs the same number of writes whatever order the input arrives in', () => {
    for (const size of sizes) {
      const writes = orders.map((order) => {
        const last = buildMergeSteps(arrangeValues(size, order), 'test').at(-1);
        return last?.kind === 'done' ? last.writes : -1;
      });
      expect(new Set(writes).size, `size=${size}`).toBe(1);
      expect(writes[0], `size=${size}`).toBe(size * levelCount(size));
    }
  });

  it('never spends more comparisons than writes, nor fewer than half', () => {
    every((size, order) => {
      const last = buildMergeSteps(arrangeValues(size, order), 'test').at(-1);
      if (last?.kind !== 'done') return;
      const context = `size=${size} order=${order}`;
      // Each write costs at most one comparison, and a merge of two runs
      // always spends at least as many as the shorter run is long.
      expect(last.comparisons, context).toBeLessThanOrEqual(last.writes);
      expect(last.comparisons, context).toBeGreaterThanOrEqual(last.writes / 2 - size);
      expect(last.comparisons, context).toBe(
        buildMergeSteps(arrangeValues(size, order), 'test').filter((s) => s.kind === 'take').length,
      );
    });
  });

  it('takes the smaller head, and the left one on a tie', () => {
    every((size, order) => {
      for (const step of buildMergeSteps(arrangeValues(size, order), 'test')) {
        if (step.kind !== 'take') continue;
        const context = `size=${size} order=${order}`;
        if (step.side === 'a') expect(step.value, context).toBeLessThanOrEqual(step.rivalValue);
        else expect(step.value, context).toBeLessThan(step.rivalValue);
      }
    });
  });

  /* A tail run with no partner is the boring path; it still has to narrate. */
  it('copies a lone tail run without spending a comparison on it', () => {
    every((size, order) => {
      const steps = buildMergeSteps(arrangeValues(size, order), 'test');
      let lone: { lo: number; hi: number } | null = null;
      for (const step of steps) {
        if (step.kind === 'lone') lone = { lo: step.lo, hi: step.hi };
        else if (step.kind === 'runs') lone = null;
        else if (step.kind === 'take' && lone !== null) {
          expect.fail(`size=${size} order=${order}: a lone run compared something`);
        } else if (step.kind === 'copy' && lone !== null) {
          expect(step.side, `size=${size} order=${order}`).toBe('a');
        }
      }
    });
  });

  it('marks the first uncompared copy of each run and counts the rest down', () => {
    every((size, order) => {
      const steps = buildMergeSteps(arrangeValues(size, order), 'test');
      let previous = -1;
      for (const step of steps) {
        if (step.kind === 'runs' || step.kind === 'lone' || step.kind === 'take') {
          previous = -1;
          continue;
        }
        if (step.kind !== 'copy') continue;
        const context = `size=${size} order=${order}`;
        expect(step.first, context).toBe(previous === -1);
        if (previous !== -1) expect(step.remaining, context).toBe(previous - 1);
        expect(step.remaining, context).toBeGreaterThanOrEqual(0);
        previous = step.remaining;
      }
    });
  });
});

describe('mergeSortAlgo', () => {
  it('narrates and paces every step kind it can emit', () => {
    const kinds = new Set<string>();
    every((size, order) => {
      for (const step of mergeSortAlgo.buildSteps({ size, order })) {
        const kind = (step as MergeStep).kind;
        kinds.add(kind);
        expect(mergeSortAlgo.statusText(step), kind).not.toBe('');
        expect(mergeSortAlgo.delayFor(step), kind).toBeGreaterThanOrEqual(0);
        expect(mergeSortAlgo.listings[0]?.lineFor(step), kind).not.toBeNull();
      }
    });
    // Every branch of the union shows up in the sizes the controls allow.
    expect([...kinds].sort()).toEqual([
      'copy',
      'done',
      'init',
      'level',
      'lone',
      'runs',
      'sweep',
      'take',
    ]);
  });

  it('highlights a line that exists in the listing', () => {
    const listing = mergeSortAlgo.listings[0];
    expect(listing).toBeDefined();
    const lines = listing?.code.split('\n').length ?? 0;
    for (const step of mergeSortAlgo.buildSteps({ size: 12, order: ORDER.shuffled })) {
      const line = listing?.lineFor(step) ?? 0;
      expect(line).toBeGreaterThan(0);
      expect(line).toBeLessThanOrEqual(lines);
    }
  });

  it('falls back to its defaults when a control is missing', () => {
    const steps = mergeSortAlgo.buildSteps({});
    const first = steps[0] as MergeStep | undefined;
    expect(first?.kind).toBe('init');
    if (first?.kind !== 'init') return;
    expect(first.values).toEqual(arrangeValues(SIZE.default, ORDER.shuffled));
  });
});
