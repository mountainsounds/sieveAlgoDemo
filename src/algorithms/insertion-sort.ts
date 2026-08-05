import { defineAlgorithm, type AlgorithmDef, type ControlValues } from './types';
import { mulberry32 } from './random';

/** One visual moment in an insertion sort run. */
export type SortStep =
  | { kind: 'init'; values: readonly number[]; arrangement: string }
  | { kind: 'seed' }
  | { kind: 'pick'; i: number; key: number; pass: number; passes: number }
  | {
      kind: 'compare';
      j: number;
      value: number;
      key: number;
      verdict: 'shift' | 'stop';
      comparisons: number;
    }
  /** The walk ran off the left end: the key is smaller than the whole run. */
  | { kind: 'wall'; key: number }
  | { kind: 'shift'; from: number; to: number; value: number; shifts: number }
  | { kind: 'place'; slot: number; key: number; moved: number; sorted: number }
  | { kind: 'done'; comparisons: number; shifts: number; worst: number; n: number };

export const SIZE = { min: 6, max: 20, default: 10 };

/** Value band for the generated arrays; the ceiling leaves the lifted key headroom. */
const LOW = 8;
const HIGH = 92;

export const ORDER = { shuffled: 0, nearly: 1, reversed: 2 };

export const ORDER_OPTIONS = [
  { value: ORDER.shuffled, label: 'shuffled' },
  { value: ORDER.nearly, label: 'nearly sorted' },
  { value: ORDER.reversed, label: 'reversed' },
] as const;

export function orderLabel(order: number): string {
  return ORDER_OPTIONS.find((option) => option.value === order)?.label ?? 'shuffled';
}

/** `size` distinct values spread over LOW..HIGH, ascending. Seeded by size. */
function ramp(size: number): number[] {
  const rand = mulberry32(size * 0x85ebca6b + 13);
  const gap = (HIGH - LOW) / size;
  const out: number[] = [];
  let prev = LOW - 1;
  for (let i = 0; i < size; i++) {
    const center = LOW + (i + 0.5) * gap;
    const jittered = Math.round(center + (rand() - 0.5) * gap * 0.8);
    out.push(Math.max(prev + 1, Math.min(HIGH, jittered)));
    prev = out[i] ?? prev + 1;
  }
  return out;
}

function isAscending(values: readonly number[]): boolean {
  return values.every((v, i) => i === 0 || v > (values[i - 1] ?? -Infinity));
}

/** A handful of adjacent transpositions, spread out — insertion sort's best case. */
function nearlySorted(base: readonly number[]): number[] {
  const out = base.slice();
  const swaps = Math.max(1, Math.floor(base.length / 5));
  for (let s = 0; s < swaps; s++) {
    const i = Math.floor(((s + 0.5) / swaps) * (base.length - 1));
    const left = out[i];
    const right = out[i + 1];
    if (left === undefined || right === undefined) continue;
    out[i] = right;
    out[i + 1] = left;
  }
  return out;
}

function shuffle(base: readonly number[], seed: number): number[] {
  const out = base.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  // A seeded shuffle can land on the sorted order; that would hide the algorithm.
  if (isAscending(out) && out.length > 1) {
    const first = out[0];
    const second = out[1];
    if (first !== undefined && second !== undefined) {
      out[0] = second;
      out[1] = first;
    }
  }
  return out;
}

/** The array to sort: deterministic per (size, order) so every run reproduces. */
export function arrangeValues(size: number, order: number): number[] {
  const base = ramp(size);
  if (order === ORDER.reversed) return base.reverse();
  if (order === ORDER.nearly) return nearlySorted(base);
  return shuffle(base, size * 0x27d4eb2d + 101);
}

/** The pure result the animation acts out. */
export function insertionSort(input: readonly number[]): number[] {
  const a = input.slice();
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    if (key === undefined) continue;
    let j = i - 1;
    for (;;) {
      const value = a[j];
      if (j < 0 || value === undefined || value <= key) break;
      a[j + 1] = value;
      j--;
    }
    a[j + 1] = key;
  }
  return a;
}

export function buildSortSteps(input: readonly number[], arrangement: string): SortStep[] {
  const a = input.slice();
  const n = a.length;
  const passes = Math.max(0, n - 1);
  const worst = (n * (n - 1)) / 2;
  const steps: SortStep[] = [{ kind: 'init', values: a.slice(), arrangement }];
  if (n === 0) {
    steps.push({ kind: 'done', comparisons: 0, shifts: 0, worst, n });
    return steps;
  }
  steps.push({ kind: 'seed' });

  let comparisons = 0;
  let shifts = 0;
  for (let i = 1; i < n; i++) {
    const key = a[i];
    if (key === undefined) continue;
    steps.push({ kind: 'pick', i, key, pass: i, passes });
    let j = i - 1;
    let moved = 0;
    for (;;) {
      if (j < 0) {
        steps.push({ kind: 'wall', key });
        break;
      }
      const value = a[j];
      if (value === undefined) break;
      comparisons++;
      if (value <= key) {
        steps.push({ kind: 'compare', j, value, key, verdict: 'stop', comparisons });
        break;
      }
      steps.push({ kind: 'compare', j, value, key, verdict: 'shift', comparisons });
      a[j + 1] = value;
      shifts++;
      moved++;
      steps.push({ kind: 'shift', from: j, to: j + 1, value, shifts });
      j--;
    }
    a[j + 1] = key;
    steps.push({ kind: 'place', slot: j + 1, key, moved, sorted: i });
  }

  steps.push({ kind: 'done', comparisons, shifts, worst, n });
  return steps;
}

const plural = (k: number, word: string): string => `${k} ${word}${k === 1 ? '' : 's'}`;

const jsListing = {
  language: 'javascript',
  label: 'insertionSort.js',
  code: `function insertionSort(a) {
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;

    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j];
      j--;
    }

    a[j + 1] = key;
  }
  return a;
}`,
  lineFor(step: SortStep): number | null {
    switch (step.kind) {
      case 'init':
        return 1;
      case 'seed':
        return 2;
      case 'pick':
        return 3;
      case 'compare':
      case 'wall':
        return 6;
      case 'shift':
        return 7;
      case 'place':
        return 11;
      case 'done':
        return 13;
    }
  },
};

export const insertionSortAlgo: AlgorithmDef = defineAlgorithm<SortStep>({
  id: 'insertion-sort',
  title: 'Insertion Sort',
  summary:
    'Sorts an array by lifting each value out and walking it left into the run that is already in order.',
  idleText: 'Each column is one value, in the order given. Press Run to sort them.',
  refs: [
    { label: 'Wikipedia', href: 'https://en.wikipedia.org/wiki/Insertion_sort' },
    {
      label: 'O(n²)',
      href: 'https://en.wikipedia.org/wiki/Insertion_sort#Best,_worst,_and_average_cases',
    },
    { label: 'LeetCode 147', href: 'https://leetcode.com/problems/insertion-sort-list/' },
  ],
  controls: [
    { id: 'size', label: 'size', min: SIZE.min, max: SIZE.max, default: SIZE.default },
    { id: 'order', label: 'order', options: ORDER_OPTIONS, default: ORDER.shuffled },
  ],
  buildSteps(values: ControlValues): SortStep[] {
    const size = values['size'] ?? SIZE.default;
    const order = values['order'] ?? ORDER.shuffled;
    return buildSortSteps(arrangeValues(size, order), orderLabel(order));
  },
  delayFor(step: SortStep): number {
    switch (step.kind) {
      case 'init':
        return 1000;
      case 'seed':
        return 1300;
      case 'pick':
        return 900;
      case 'compare':
        // The comparison that ends a walk is the moment worth holding on.
        return step.verdict === 'stop' ? 640 : 440;
      case 'wall':
        return 700;
      case 'shift':
        return 320;
      case 'place':
        return 800;
      case 'done':
        return 0;
    }
  },
  statusText(step: SortStep): string {
    switch (step.kind) {
      case 'init':
        return `${step.values.length} values, ${step.arrangement}`;
      case 'seed':
        return 'a[0] on its own already counts as sorted';
      case 'pick':
        return `pass ${step.pass} of ${step.passes} — lift a[${step.i}] = ${step.key} out`;
      case 'compare':
        return step.verdict === 'shift'
          ? `a[${step.j}] = ${step.value} > ${step.key} — shift it right`
          : `a[${step.j}] = ${step.value} ≤ ${step.key} — ${step.key} belongs just after it`;
      case 'wall':
        return `nothing left to compare — ${step.key} is the smallest so far`;
      case 'shift':
        return `${step.value} slides to index ${step.to} — the gap opens at ${step.from}`;
      case 'place':
        return step.moved === 0
          ? `${step.key} was already in place — sorted through index ${step.sorted}`
          : `${step.key} drops into index ${step.slot} — sorted through index ${step.sorted}`;
      case 'done':
        return step.shifts === 0
          ? `already in order — ${plural(step.comparisons, 'comparison')}, nothing moved`
          : `sorted — ${plural(step.comparisons, 'comparison')}, ` +
              `${plural(step.shifts, 'shift')} (worst case ${step.worst})`;
    }
  },
  chipFor(step: SortStep) {
    switch (step.kind) {
      case 'pick':
        return { text: `pass ${step.pass} of ${step.passes}` };
      case 'done':
        return {
          text:
            step.shifts === 0 ? 'sorted · no shifts' : `sorted · ${plural(step.shifts, 'shift')}`,
          final: true,
        };
      default:
        return null;
    }
  },
  listings: [jsListing],
});
