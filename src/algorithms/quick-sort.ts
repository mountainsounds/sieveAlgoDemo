import { defineAlgorithm, type AlgorithmDef, type ControlValues } from './types';
import { arrangeValues, orderLabel, ORDER, ORDER_OPTIONS } from './arrange';

/**
 * Quicksort with Lomuto partitioning and a last-value pivot.
 *
 * Merge sort here is bottom-up because a recursive listing needs a call stack
 * to say which frame a highlighted line is in, and an iterative form existed
 * that read just as well. Quicksort has no such form — the iterative version
 * needs an explicit stack of ranges, which turns the Java listing into
 * `Deque<int[]>` boilerplate that teaches nothing about the algorithm. So the
 * recursion stays, and the *picture* carries the frame instead: the range being
 * partitioned is drawn on the row, and every range still waiting its turn is
 * drawn beside it. Those ranges are always disjoint — the stack of pending
 * work exactly tiles the part of the row that isn't settled yet — so the whole
 * call stack fits on one rail without nesting.
 *
 * The last-value pivot is the reason the `order` control earns its place. On a
 * shuffled row the splits are roughly even and the work is near n log n; on an
 * ordered row — sorted *or* reversed — the pivot is always the extreme value,
 * every split is empty on one side, and it degrades to the same n(n-1)/2 that
 * insertion sort spends. Nearly sorted is insertion sort's best case and
 * quicksort's worst, on identical input, which is the pair worth seeing.
 */

/** Which recursive call a frame came from. */
export type Side = 'root' | 'left' | 'right';

/** An inclusive slot range, `[lo, hi]`. */
export type Range = readonly [number, number];

/** One visual moment in a quicksort run. */
export type QuickStep =
  | { kind: 'init'; values: readonly number[]; arrangement: string; worst: number }
  /**
   * Entering a frame: the call site, before the guard runs. `pending` is every
   * range still on the stack. They never overlap each other or `[lo, hi]`, so
   * the whole call stack draws on one rail.
   */
  | { kind: 'call'; lo: number; hi: number; depth: number; side: Side; pending: readonly Range[] }
  /** The `lo >= hi` guard. `trivial` is whether this frame returns right away. */
  | { kind: 'guard'; lo: number; hi: number; trivial: boolean; depth: number }
  | { kind: 'pivot'; index: number; value: number; lo: number; hi: number; depth: number }
  | {
      kind: 'scan';
      j: number;
      value: number;
      pivot: number;
      /** The boundary: everything below this index is already on the low side. */
      i: number;
      less: boolean;
      comparisons: number;
    }
  /** Lomuto swaps even when i === j; `moved` says whether anything travelled. */
  | {
      kind: 'swap';
      i: number;
      j: number;
      value: number;
      other: number;
      moved: boolean;
      low: number;
    }
  | { kind: 'settle'; index: number; value: number; lo: number; hi: number; moved: boolean }
  | {
      kind: 'done';
      comparisons: number;
      swaps: number;
      partitions: number;
      depth: number;
      worst: number;
      n: number;
    };

export const SIZE = { min: 6, max: 20, default: 12 };

/** Comparisons an ordered row costs: every split empty on one side. */
export function worstCase(n: number): number {
  return (n * (n - 1)) / 2;
}

/** The pure result the animation acts out. */
export function quickSort(input: readonly number[]): number[] {
  const a = input.slice();
  sort(a, 0, a.length - 1);
  return a;
}

function sort(a: number[], lo: number, hi: number): void {
  if (lo >= hi) return;
  const pivot = a[hi];
  if (pivot === undefined) return;
  let i = lo;
  for (let j = lo; j < hi; j++) {
    const value = a[j];
    if (value === undefined) continue;
    if (value < pivot) {
      swap(a, i, j);
      i++;
    }
  }
  swap(a, i, hi);
  sort(a, lo, i - 1);
  sort(a, i + 1, hi);
}

function swap(a: number[], x: number, y: number): void {
  const left = a[x];
  const right = a[y];
  if (left === undefined || right === undefined) return;
  a[x] = right;
  a[y] = left;
}

export function buildQuickSteps(input: readonly number[], arrangement: string): QuickStep[] {
  const a = input.slice();
  const n = a.length;
  const worst = worstCase(n);
  const steps: QuickStep[] = [{ kind: 'init', values: a.slice(), arrangement, worst }];

  let comparisons = 0;
  let swaps = 0;
  let partitions = 0;
  let deepest = 0;
  /** Ranges pushed but not yet entered — the right halves waiting their turn. */
  const pending: Range[] = [];

  const walk = (lo: number, hi: number, depth: number, side: Side): void => {
    deepest = Math.max(deepest, depth);
    steps.push({ kind: 'call', lo, hi, depth, side, pending: pending.map((r) => [r[0], r[1]]) });
    const trivial = lo >= hi;
    steps.push({ kind: 'guard', lo, hi, trivial, depth });
    if (trivial) return;

    const pivot = a[hi];
    if (pivot === undefined) return;
    partitions++;
    steps.push({ kind: 'pivot', index: hi, value: pivot, lo, hi, depth });

    let i = lo;
    for (let j = lo; j < hi; j++) {
      const value = a[j];
      if (value === undefined) continue;
      comparisons++;
      const less = value < pivot;
      steps.push({ kind: 'scan', j, value, pivot, i, less, comparisons });
      if (!less) continue;
      const other = a[i] ?? value;
      const moved = i !== j;
      swap(a, i, j);
      if (moved) swaps++;
      steps.push({ kind: 'swap', i, j, value, other, moved, low: i - lo + 1 });
      i++;
    }

    const movedPivot = i !== hi;
    swap(a, i, hi);
    if (movedPivot) swaps++;
    steps.push({ kind: 'settle', index: i, value: pivot, lo, hi, moved: movedPivot });

    // The right half waits on the stack for the whole of the left half.
    pending.push([i + 1, hi]);
    walk(lo, i - 1, depth + 1, 'left');
    pending.pop();
    walk(i + 1, hi, depth + 1, 'right');
  };

  if (n > 0) walk(0, n - 1, 1, 'root');
  steps.push({ kind: 'done', comparisons, swaps, partitions, depth: deepest, worst, n });
  return steps;
}

const plural = (k: number, word: string): string => `${k} ${word}${k === 1 ? '' : 's'}`;

/* All three listings recurse, and all three return `a` so the panel shows a
   function you could actually call. Python's guard is two lines, so it is the
   one language where a range that returns immediately lights a different line
   from one that carries on. */

const jsListing = {
  language: 'javascript',
  label: 'quickSort.js',
  code: `function quickSort(a, lo, hi) {
  if (lo >= hi) return a;

  const pivot = a[hi];
  let i = lo;

  for (let j = lo; j < hi; j++) {
    if (a[j] < pivot) {
      [a[i], a[j]] = [a[j], a[i]];
      i++;
    }
  }

  [a[i], a[hi]] = [a[hi], a[i]];

  quickSort(a, lo, i - 1);
  quickSort(a, i + 1, hi);
  return a;
}`,
  lineFor(step: QuickStep): number | null {
    switch (step.kind) {
      case 'init':
        return 1;
      case 'call':
        return step.side === 'left' ? 16 : step.side === 'right' ? 17 : 1;
      case 'guard':
        return 2;
      case 'pivot':
        return 4;
      case 'scan':
        return 8;
      case 'swap':
        return 9;
      case 'settle':
        return 14;
      case 'done':
        return 18;
    }
  },
};

const pyListing = {
  language: 'python',
  label: 'quick_sort.py',
  code: `def quick_sort(a, lo, hi):
    if lo >= hi:
        return a

    pivot = a[hi]
    i = lo

    for j in range(lo, hi):
        if a[j] < pivot:
            a[i], a[j] = a[j], a[i]
            i += 1

    a[i], a[hi] = a[hi], a[i]

    quick_sort(a, lo, i - 1)
    quick_sort(a, i + 1, hi)
    return a`,
  lineFor(step: QuickStep): number | null {
    switch (step.kind) {
      case 'init':
        return 1;
      case 'call':
        return step.side === 'left' ? 15 : step.side === 'right' ? 16 : 1;
      // The only listing that splits the test from the return, so a range that
      // stops here lands a line lower than one that carries on.
      case 'guard':
        return step.trivial ? 3 : 2;
      case 'pivot':
        return 5;
      case 'scan':
        return 9;
      case 'swap':
        return 10;
      case 'settle':
        return 13;
      case 'done':
        return 17;
    }
  },
};

const javaListing = {
  language: 'java',
  label: 'QuickSort.java',
  // A swap gets three lines rather than three statements crammed onto one: it
  // is how Java is actually written, and a crammed line is too wide to read on
  // a phone without scrolling — which matters here, because the swap is a line
  // the panel highlights. The inner `t` goes out of scope with the if-block,
  // so the second one is a fresh declaration rather than a shadow.
  code: `static int[] quickSort(int[] a, int lo, int hi) {
  if (lo >= hi) return a;

  int pivot = a[hi];
  int i = lo;

  for (int j = lo; j < hi; j++) {
    if (a[j] < pivot) {
      int t = a[i];
      a[i] = a[j];
      a[j] = t;
      i++;
    }
  }

  int t = a[i];
  a[i] = a[hi];
  a[hi] = t;

  quickSort(a, lo, i - 1);
  quickSort(a, i + 1, hi);
  return a;
}`,
  lineFor(step: QuickStep): number | null {
    switch (step.kind) {
      case 'init':
        return 1;
      case 'call':
        return step.side === 'left' ? 20 : step.side === 'right' ? 21 : 1;
      case 'guard':
        return 2;
      case 'pivot':
        return 4;
      case 'scan':
        return 8;
      // The middle line of the three: where a[i] takes the new value.
      case 'swap':
        return 10;
      case 'settle':
        return 17;
      case 'done':
        return 22;
    }
  },
};

export const quickSortAlgo: AlgorithmDef = defineAlgorithm<QuickStep>({
  id: 'quick-sort',
  title: 'Quicksort',
  summary:
    'Sorts an array by picking a pivot, moving everything smaller to its left, and repeating on each side.',
  idleText: 'Each column is one value. The last value in a range becomes its pivot; press Run.',
  refs: [
    { label: 'Wikipedia', href: 'https://en.wikipedia.org/wiki/Quicksort' },
    { label: 'O(n log n) average', href: 'https://en.wikipedia.org/wiki/Quicksort#Analysis' },
    {
      label: 'LeetCode 215',
      href: 'https://leetcode.com/problems/kth-largest-element-in-an-array/',
    },
  ],
  controls: [
    { id: 'size', label: 'size', min: SIZE.min, max: SIZE.max, default: SIZE.default },
    { id: 'order', label: 'order', options: ORDER_OPTIONS, default: ORDER.shuffled },
  ],
  buildSteps(values: ControlValues): QuickStep[] {
    const size = values['size'] ?? SIZE.default;
    const order = values['order'] ?? ORDER.shuffled;
    return buildQuickSteps(arrangeValues(size, order), orderLabel(order));
  },
  delayFor(step: QuickStep): number {
    switch (step.kind) {
      case 'init':
        return 1000;
      case 'call':
        return 700;
      case 'guard':
        return step.trivial ? 800 : 560;
      case 'pivot':
        return 1000;
      case 'scan':
        return 420;
      // A swap that moves nothing should feel cheaper than one that does.
      case 'swap':
        return step.moved ? 540 : 300;
      case 'settle':
        return 1000;
      case 'done':
        return 0;
    }
  },
  statusText(step: QuickStep): string {
    switch (step.kind) {
      case 'init':
        return `${step.values.length} values, ${step.arrangement} — worst case ${step.worst} comparisons`;
      case 'call':
        if (step.side === 'root') return `sort the whole row — indices ${step.lo} to ${step.hi}`;
        if (step.lo > step.hi) return `nothing on the ${step.side} of that pivot`;
        return `now the ${step.side} side — indices ${step.lo} to ${step.hi}`;
      case 'guard':
        if (!step.trivial) return `${plural(step.hi - step.lo + 1, 'value')} to partition`;
        return step.lo > step.hi
          ? 'an empty range — nothing to sort, back up'
          : `a[${step.lo}] is on its own — already in place, back up`;
      case 'pivot':
        return `pivot = ${step.value}, the last value — everything smaller goes left of it`;
      case 'scan':
        return step.less
          ? `a[${step.j}] = ${step.value} < ${step.pivot} — it belongs on the low side`
          : `a[${step.j}] = ${step.value} ≥ ${step.pivot} — leave it on the high side`;
      case 'swap':
        return step.moved
          ? `${step.value} and ${step.other} trade places — the low side is ${plural(step.low, 'value')} wide`
          : `${step.value} is already on the low side — the boundary moves past it`;
      case 'settle':
        return step.moved
          ? `the pivot drops into index ${step.index} — that value is finished`
          : `the pivot was already at index ${step.index} — that value is finished`;
      case 'done':
        return step.comparisons >= step.worst
          ? `sorted — ${plural(step.comparisons, 'comparison')}, the worst case: ` +
              'an ordered row puts the pivot at one end every time'
          : `sorted — ${plural(step.comparisons, 'comparison')} across ` +
              `${plural(step.partitions, 'partition')}, ${step.depth} deep (worst case ${step.worst})`;
    }
  },
  chipFor(step: QuickStep) {
    switch (step.kind) {
      case 'call':
        return {
          text:
            step.pending.length === 0
              ? `depth ${step.depth}`
              : `depth ${step.depth} · ${plural(step.pending.length, 'range')} waiting`,
        };
      case 'done':
        return { text: `sorted · ${plural(step.comparisons, 'comparison')}`, final: true };
      default:
        return null;
    }
  },
  listings: [jsListing, pyListing, javaListing],
});
