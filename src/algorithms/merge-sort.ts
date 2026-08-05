import { defineAlgorithm, type AlgorithmDef, type ControlValues } from './types';
import { arrangeValues, orderLabel, ORDER, ORDER_OPTIONS } from './arrange';

/**
 * Bottom-up merge sort. The array starts as n sorted runs of one; each level
 * merges neighbouring runs pairwise, doubling the run length, until one run is
 * left. That is ⌈log₂ n⌉ levels, and every level writes all n values — which
 * is the whole n log n story, countable on screen.
 *
 * Bottom-up rather than the textbook recursion: the code panel highlights one
 * line per step, and a recursive listing would need a call stack to say which
 * frame that line is in. A level-at-a-time sweep maps one-to-one onto the
 * iterative listing below, and onto the picture — left to right, level by level.
 */

/** Which of the two runs being merged a value came from. */
export type Side = 'a' | 'b';

/** One visual moment in a merge sort run. */
export type MergeStep =
  | { kind: 'init'; values: readonly number[]; arrangement: string; levels: number }
  | { kind: 'level'; level: number; levels: number; width: number; merges: number }
  /** The next pair of runs: a is lo..mid-1, b is mid..hi-1. */
  | { kind: 'runs'; lo: number; mid: number; hi: number }
  /** An odd run at the tail with no partner — it copies down untouched. */
  | { kind: 'lone'; lo: number; hi: number }
  /** Both runs still had a head, so this write cost a comparison. */
  | {
      kind: 'take';
      from: number;
      to: number;
      value: number;
      side: Side;
      rival: number;
      rivalValue: number;
      nextA: number | null;
      nextB: number | null;
      comparisons: number;
    }
  /** One run is spent; the rest of the other copies down with no comparison. */
  | {
      kind: 'copy';
      from: number;
      to: number;
      value: number;
      side: Side;
      remaining: number;
      first: boolean;
      nextA: number | null;
      nextB: number | null;
    }
  /** The level is finished: the output lane becomes the input for the next one. */
  | { kind: 'sweep'; level: number; levels: number; writes: number; values: readonly number[] }
  | { kind: 'done'; comparisons: number; writes: number; levels: number; n: number };

export const SIZE = { min: 4, max: 20, default: 16 };

/** Levels the bottom-up loop runs, i.e. ⌈log₂ n⌉. */
export function levelCount(n: number): number {
  let levels = 0;
  for (let width = 1; width < n; width *= 2) levels++;
  return levels;
}

/** The pure result the animation acts out. */
export function mergeSort(input: readonly number[]): number[] {
  let a = input.slice();
  const n = a.length;
  // One auxiliary array for the whole sort — the O(n) space merge sort trades
  // for its guaranteed O(n log n) time.
  const out = a.slice();
  for (let width = 1; width < n; width *= 2) {
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n);
      const hi = Math.min(lo + 2 * width, n);
      let i = lo;
      let j = mid;
      for (let k = lo; k < hi; k++) {
        const left = a[i];
        const right = a[j];
        const takeLeft =
          i < mid && (j >= hi || right === undefined || (left ?? 0) <= right) && left !== undefined;
        if (takeLeft) {
          out[k] = left;
          i++;
        } else if (right !== undefined) {
          out[k] = right;
          j++;
        }
      }
    }
    a = out.slice();
  }
  return a;
}

export function buildMergeSteps(input: readonly number[], arrangement: string): MergeStep[] {
  let a = input.slice();
  const n = a.length;
  const levels = levelCount(n);
  const steps: MergeStep[] = [{ kind: 'init', values: a.slice(), arrangement, levels }];
  if (n < 2) {
    steps.push({ kind: 'done', comparisons: 0, writes: 0, levels, n });
    return steps;
  }

  let comparisons = 0;
  let writes = 0;
  let level = 0;

  for (let width = 1; width < n; width *= 2) {
    level++;
    let merges = 0;
    for (let lo = 0; lo < n; lo += 2 * width) merges++;
    steps.push({ kind: 'level', level, levels, width, merges });

    const out = a.slice();
    for (let lo = 0; lo < n; lo += 2 * width) {
      const mid = Math.min(lo + width, n);
      const hi = Math.min(lo + 2 * width, n);
      let i = lo;
      let j = mid;
      // A tail run with no partner still costs a full pass of writes.
      if (mid >= hi) steps.push({ kind: 'lone', lo, hi });
      else steps.push({ kind: 'runs', lo, mid, hi });

      let copying = false;
      for (let k = lo; k < hi; k++) {
        const left = a[i];
        const right = a[j];
        const leftLive = i < mid && left !== undefined;
        const rightLive = j < hi && right !== undefined;
        if (!leftLive && !rightLive) break;

        const compared = leftLive && rightLive;
        // `<=` keeps the sort stable: on a tie the left run always goes first.
        const side: Side = compared
          ? (left ?? 0) <= (right ?? 0)
            ? 'a'
            : 'b'
          : leftLive
            ? 'a'
            : 'b';
        const from = side === 'a' ? i : j;
        const value = (side === 'a' ? left : right) ?? 0;

        out[k] = value;
        writes++;
        if (side === 'a') i++;
        else j++;
        const nextA = i < mid ? i : null;
        const nextB = j < hi ? j : null;

        if (compared) {
          comparisons++;
          copying = false;
          steps.push({
            kind: 'take',
            from,
            to: k,
            value,
            side,
            rival: side === 'a' ? j : i,
            rivalValue: (side === 'a' ? right : left) ?? 0,
            nextA,
            nextB,
            comparisons,
          });
        } else {
          steps.push({
            kind: 'copy',
            from,
            to: k,
            value,
            side,
            remaining: side === 'a' ? mid - i : hi - j,
            first: !copying,
            nextA,
            nextB,
          });
          copying = true;
        }
      }
    }
    a = out;
    steps.push({ kind: 'sweep', level, levels, writes, values: a.slice() });
  }

  steps.push({ kind: 'done', comparisons, writes, levels, n });
  return steps;
}

const plural = (k: number, word: string): string => `${k} ${word}${k === 1 ? '' : 's'}`;

const runName = (side: Side): string => (side === 'a' ? 'left' : 'right');

const jsListing = {
  language: 'javascript',
  label: 'mergeSort.js',
  // Lines stay under ~58 characters: the code panel scrolls, but the line
  // being highlighted is the one that must never need scrolling to read.
  code: `function mergeSort(a) {
  const out = a.slice();
  for (let w = 1; w < a.length; w *= 2) {
    for (let lo = 0; lo < a.length; lo += 2 * w) {
      const mid = Math.min(lo + w, a.length);
      const hi = Math.min(lo + 2 * w, a.length);
      let i = lo, j = mid;

      for (let k = lo; k < hi; k++) {
        const left = i < mid && (j >= hi || a[i] <= a[j]);
        if (left) out[k] = a[i++];
        else out[k] = a[j++];
      }
    }
    a = out.slice();
  }
  return a;
}`,
  lineFor(step: MergeStep): number | null {
    switch (step.kind) {
      case 'init':
        return 2;
      case 'level':
        return 3;
      case 'runs':
      case 'lone':
        return 4;
      // The left run wins either on the `a[i] <= a[j]` test or by short-circuit
      // once the right one is spent; the branch taken is what differs.
      case 'take':
      case 'copy':
        return step.side === 'a' ? 11 : 12;
      case 'sweep':
        return 15;
      case 'done':
        return 17;
    }
  },
};

export const mergeSortAlgo: AlgorithmDef = defineAlgorithm<MergeStep>({
  id: 'merge-sort',
  title: 'Merge Sort',
  summary:
    'Sorts an array by merging neighbouring sorted runs, doubling the run length each sweep, so every input takes the same number of sweeps.',
  idleText: 'Each column is one value. Merge sort needs a second lane to merge into; press Run.',
  refs: [
    { label: 'Wikipedia', href: 'https://en.wikipedia.org/wiki/Merge_sort' },
    { label: 'O(n log n)', href: 'https://en.wikipedia.org/wiki/Merge_sort#Analysis' },
    { label: 'LeetCode 912', href: 'https://leetcode.com/problems/sort-an-array/' },
  ],
  controls: [
    { id: 'size', label: 'size', min: SIZE.min, max: SIZE.max, default: SIZE.default },
    { id: 'order', label: 'order', options: ORDER_OPTIONS, default: ORDER.shuffled },
  ],
  buildSteps(values: ControlValues): MergeStep[] {
    const size = values['size'] ?? SIZE.default;
    const order = values['order'] ?? ORDER.shuffled;
    return buildMergeSteps(arrangeValues(size, order), orderLabel(order));
  },
  delayFor(step: MergeStep): number {
    switch (step.kind) {
      case 'init':
        return 1000;
      case 'level':
        return 1100;
      // Longer runs are a bigger claim to take in, so they get longer to land.
      case 'runs':
        return Math.min(900, 420 + (step.mid - step.lo) * 70);
      case 'lone':
        return 800;
      case 'take':
        return 300;
      // A copy costs no comparison, and it should feel cheaper than one.
      case 'copy':
        return step.first ? 380 : 190;
      case 'sweep':
        return 1000;
      case 'done':
        return 0;
    }
  },
  statusText(step: MergeStep): string {
    switch (step.kind) {
      case 'init':
        return `${step.values.length} values, ${step.arrangement} — ${plural(step.levels, 'sweep')} to sort`;
      case 'level': {
        const from = plural(step.width, 'value');
        return step.level === step.levels
          ? `level ${step.level} of ${step.levels} — merge the last two runs into one`
          : `level ${step.level} of ${step.levels} — merge runs of ${from} into runs of ${step.width * 2}`;
      }
      case 'runs':
        return (
          `merge a[${step.lo}..${step.mid - 1}] with a[${step.mid}..${step.hi - 1}] — ` +
          'both are already sorted'
        );
      case 'lone':
        return (
          `a[${step.lo}..${step.hi - 1}] has no run to pair with — ` +
          'it copies down and waits for the next level'
        );
      case 'take':
        return (
          `${step.value} ${step.value === step.rivalValue ? '=' : '<'} ${step.rivalValue} — ` +
          `the ${runName(step.side)} run gives up ${step.value}`
        );
      case 'copy':
        return step.first
          ? `the ${runName(step.side === 'a' ? 'b' : 'a')} run is empty — ` +
              `the ${runName(step.side)} run's last ${plural(step.remaining + 1, 'value')} ` +
              'copy down with no comparison'
          : `${step.value} copies down — nothing left to compare it against`;
      case 'sweep':
        return step.level === step.levels
          ? `level ${step.level} written — ${plural(step.writes, 'write')} in total`
          : `level ${step.level} done — the output moves up and becomes the next level's input`;
      case 'done':
        return (
          `sorted — ${step.levels} levels × ${step.n} writes = ${step.writes}, ` +
          `and ${plural(step.comparisons, 'comparison')}`
        );
    }
  },
  chipFor(step: MergeStep) {
    switch (step.kind) {
      case 'level':
        return { text: `level ${step.level} of ${step.levels}` };
      case 'done':
        return { text: `sorted · ${plural(step.writes, 'write')}`, final: true };
      default:
        return null;
    }
  },
  listings: [jsListing],
});
