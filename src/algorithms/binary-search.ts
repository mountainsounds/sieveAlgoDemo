import { defineAlgorithm, type AlgorithmDef, type ControlValues } from './types';
import { mulberry32 } from './random';

/** One visual moment in a binary search run. */
export type SearchStep =
  | { kind: 'init'; values: readonly number[]; target: number }
  | { kind: 'level-set'; target: number; n: number }
  | { kind: 'probe'; lo: number; hi: number; mid: number; probe: number; cap: number }
  | { kind: 'compare'; mid: number; value: number; target: number; verdict: 'lt' | 'gt' | 'eq' }
  | { kind: 'discard'; side: 'left' | 'right'; from: number; to: number; lo: number; hi: number }
  | { kind: 'found'; index: number; value: number; target: number; probes: number }
  | {
      kind: 'not-found';
      target: number;
      probes: number;
      /** Neighbors around the gap the target falls into; null past either end. */
      below: number | null;
      above: number | null;
    };

export const SIZE = { min: 4, max: 48, default: 24 };
export const TARGET = { min: 0, max: 99 };

/**
 * The array being searched: `size` distinct values in 2..99, sorted. A jittered
 * ramp seeded by the size, so every size gets its own array, reloads and deep
 * links reproduce it, and the spread leaves gaps for not-found targets.
 */
export function sortedValues(size: number): number[] {
  const rand = mulberry32(size * 0x9e3779b9 + 7);
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

/** Index of target in a, or -1. The pure result the animation acts out. */
export function binarySearch(a: readonly number[], target: number): number {
  let lo = 0;
  let hi = a.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const v = a[mid];
    if (v === target) return mid;
    if (v !== undefined && v < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/** Probes needed to conclude, for the "probe k of ≤cap" chip. */
export function probeCap(n: number): number {
  return Math.floor(Math.log2(n)) + 1;
}

export function buildSearchSteps(values: readonly number[], target: number): SearchStep[] {
  const n = values.length;
  const cap = probeCap(n);
  const steps: SearchStep[] = [
    { kind: 'init', values, target },
    { kind: 'level-set', target, n },
  ];

  let lo = 0;
  let hi = n - 1;
  let probes = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const value = values[mid];
    if (value === undefined) break;
    probes++;
    steps.push({ kind: 'probe', lo, hi, mid, probe: probes, cap });
    if (value === target) {
      steps.push({ kind: 'compare', mid, value, target, verdict: 'eq' });
      steps.push({ kind: 'found', index: mid, value, target, probes });
      return steps;
    }
    if (value < target) {
      steps.push({ kind: 'compare', mid, value, target, verdict: 'lt' });
      steps.push({ kind: 'discard', side: 'left', from: lo, to: mid, lo: mid + 1, hi });
      lo = mid + 1;
    } else {
      steps.push({ kind: 'compare', mid, value, target, verdict: 'gt' });
      steps.push({ kind: 'discard', side: 'right', from: mid, to: hi, lo, hi: mid - 1 });
      hi = mid - 1;
    }
  }
  // The loop ends with lo at the insertion point: everything left of lo is
  // smaller than the target, everything from lo up is larger.
  steps.push({
    kind: 'not-found',
    target,
    probes,
    below: values[lo - 1] ?? null,
    above: values[lo] ?? null,
  });
  return steps;
}

/**
 * A present value that needs the most probes, preferring one near mid-range —
 * the default demo is a full hunt with the level drawn across the middle.
 */
function worstCaseTarget(size: number): number {
  const values = sortedValues(size);
  let best = values[0] ?? 2;
  let bestProbes = 0;
  for (const v of values) {
    const probes = buildSearchSteps(values, v).filter((s) => s.kind === 'probe').length;
    if (probes > bestProbes || (probes === bestProbes && Math.abs(v - 55) < Math.abs(best - 55))) {
      best = v;
      bestProbes = probes;
    }
  }
  return best;
}

const plural = (k: number): string => (k === 1 ? 'probe' : 'probes');

const jsListing = {
  language: 'javascript',
  label: 'binarySearch.js',
  code: `function binarySearch(a, target) {
  let lo = 0;
  let hi = a.length - 1;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);

    if (a[mid] === target) {
      return mid;
    }
    if (a[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return -1;
}`,
  lineFor(step: SearchStep): number | null {
    switch (step.kind) {
      case 'init':
        return 2;
      case 'level-set':
        return 3;
      case 'probe':
        return 6;
      case 'compare':
        return 8;
      case 'discard':
        return step.side === 'left' ? 12 : 14;
      case 'found':
        return 9;
      case 'not-found':
        return 18;
    }
  },
};

export const binarySearchAlgo: AlgorithmDef = defineAlgorithm<SearchStep>({
  id: 'binary-search',
  title: 'Binary Search',
  summary: 'Finds a target in a sorted array by halving the search window with every probe.',
  idleText: 'Each bar is one value; the line is the target. Press Run.',
  refs: [
    { label: 'Wikipedia', href: 'https://en.wikipedia.org/wiki/Binary_search' },
    { label: 'O(log n)', href: 'https://en.wikipedia.org/wiki/Binary_search#Performance' },
    { label: 'LeetCode 704', href: 'https://leetcode.com/problems/binary-search/' },
  ],
  controls: [
    { id: 'size', label: 'size', min: SIZE.min, max: SIZE.max, default: SIZE.default },
    {
      id: 'target',
      label: 'target',
      min: TARGET.min,
      max: TARGET.max,
      default: worstCaseTarget(SIZE.default),
    },
  ],
  buildSteps(values: ControlValues): SearchStep[] {
    const size = values['size'] ?? SIZE.default;
    return buildSearchSteps(sortedValues(size), values['target'] ?? TARGET.min);
  },
  delayFor(step: SearchStep): number {
    switch (step.kind) {
      case 'init':
        return 1000;
      case 'level-set':
        return 1500;
      case 'probe':
        return 1400;
      case 'compare':
        return 1600;
      case 'discard':
        return 1500;
      case 'found':
      case 'not-found':
        return 0;
    }
  },
  statusText(step: SearchStep): string {
    switch (step.kind) {
      case 'init':
        return `${step.values.length} values in sorted order`;
      case 'level-set':
        return `looking for ${step.target} between index 0 and ${step.n - 1}`;
      case 'probe':
        return `mid = ⌊(${step.lo} + ${step.hi}) / 2⌋ = ${step.mid}`;
      case 'compare':
        if (step.verdict === 'eq') return `a[${step.mid}] = ${step.value} — match`;
        return step.verdict === 'lt'
          ? `a[${step.mid}] = ${step.value} < ${step.target} — target is higher`
          : `a[${step.mid}] = ${step.value} > ${step.target} — target is lower`;
      case 'discard':
        return step.lo > step.hi
          ? 'window empty — nothing left'
          : `window [${step.lo}, ${step.hi}] — ${step.hi - step.lo + 1} left`;
      case 'found':
        return `found ${step.target} at index ${step.index} — ${step.probes} ${plural(step.probes)}`;
      case 'not-found':
        if (step.below === null && step.above !== null)
          return `${step.target} is not in the array — smaller than every value`;
        if (step.above === null && step.below !== null)
          return `${step.target} is not in the array — larger than every value`;
        return `${step.target} is not in the array — it falls between ${step.below} and ${step.above}`;
    }
  },
  chipFor(step: SearchStep) {
    switch (step.kind) {
      case 'probe':
        return { text: `probe ${step.probe} of ≤${step.cap}` };
      case 'found':
        return { text: `index ${step.index} · ${step.probes} ${plural(step.probes)}`, final: true };
      case 'not-found':
        return { text: `not found · ${step.probes} ${plural(step.probes)}`, final: true };
      default:
        return null;
    }
  },
  listings: [jsListing],
});
